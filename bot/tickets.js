// تذكرة الشراء: فتح الروم الخاص + التحويل + استلام الإيصال + القبول/الرفض + التسليم
const {
  ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, AttachmentBuilder,
} = require('discord.js');
const cfg = require('../server/config');
const { read, update } = require('../server/db');
const events = require('../server/events');
const { isMerchant } = require('../server/auth');
const { approve, reject: rejectOrder } = require('../server/orders');

const money = n => `${n} ريال`;

const linkRow = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setLabel('ربط حسابي بالموقع').setStyle(ButtonStyle.Link).setURL(`${cfg.baseUrl}/auth/login`),
);
const closeRow = id => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`orbit:close:${id}`).setLabel('إغلاق التذكرة (للإدارة)').setStyle(ButtonStyle.Danger),
);
const reviewRow = id => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`orbit:accept:${id}`).setLabel('قبول وتسليم').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(`orbit:reject:${id}`).setLabel('رفض').setStyle(ButtonStyle.Danger),
);

const bankText = () => {
  const b = cfg.bank;
  return b.iban
    ? `**البنك:** ${b.name}\n**الآيبان:** \`${b.iban}\`\n**المستفيد:** ${b.holder}`
    : 'بيانات التحويل قيد الإعداد، تواصل مع الإدارة.';
};

async function openTicket(i, pid) {
  await i.deferReply({ ephemeral: true });
  const db = read();
  const user = db.users[i.user.id];
  const p = db.products.find(x => x.id === pid);

  if (!user) {
    return i.editReply({ content: 'لازم تربط حسابك بالموقع أول عشان نوصل لك الطلب.', components: [linkRow()] });
  }
  if (!p) return i.editReply('المنتج ما عاد موجود.');
  if (!p.stock.length) return i.editReply('المنتج غير متوفر حالياً.');

  const open = db.tickets.find(t => t.userId === i.user.id && t.status === 'open');
  if (open) return i.editReply(`عندك تذكرة مفتوحة بالفعل: <#${open.channelId}>`);

  const guild = i.guild;
  const me = i.client.user.id;
  const V = PermissionFlagsBits.ViewChannel;
  const channel = await guild.channels.create({
    name: `شراء-${i.user.username}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: cfg.discord.ticketCategoryId || undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [V] },
      {
        id: i.user.id,
        allow: [V, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
      },
      {
        id: me,
        allow: [V, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
      },
    ],
  });

  const order = await update(db => {
    const o = {
      id: 'ORB-' + (++db.seq),
      userId: i.user.id,
      userName: user.name,
      productId: p.id,
      productName: p.name,
      price: p.price,
      receipt: null,
      status: 'awaiting_receipt',
      source: 'discord',
      channelId: channel.id,
      createdAt: Date.now(),
      item: null,
    };
    db.orders.push(o);
    db.tickets.push({ channelId: channel.id, userId: i.user.id, orderId: o.id, status: 'open', createdAt: Date.now() });
    return o;
  });

  const e = new EmbedBuilder()
    .setColor(0x2ac55a)
    .setTitle(`طلب ${order.id}`)
    .setDescription(
      `أهلاً <@${i.user.id}> 👋\nاخترت **${p.name}**\n\n**المبلغ:** ${money(p.price)}\n\n${bankText()}\n\n📸 حوّل المبلغ، ثم **أرسل صورة الإيصال هنا** في هذه التذكرة.`,
    );
  await channel.send({ content: `<@${i.user.id}>`, embeds: [e], components: [closeRow(channel.id)] });
  return i.editReply(`تم فتح تذكرتك: <#${channel.id}>`);
}

// أزرار القبول/الرفض/الإغلاق (للإدارة فقط)
async function handleTicketInteraction(i) {
  const [, action, id] = i.customId.split(':');
  if (!['accept', 'reject', 'close'].includes(action)) return false;

  if (!isMerchant(i.user.id)) {
    await i.reply({ content: 'ما عندك صلاحية.', ephemeral: true });
    return true;
  }

  if (action === 'accept') {
    await i.deferUpdate();
    const out = await approve(id);
    if (out.error) {
      await i.followUp({ content: `ما نقدر نقبل الطلب: ${out.error}`, ephemeral: true });
      return true;
    }
    events.emit('order:delivered', id);
    await i.editReply({ content: `✅ تم القبول والتسليم بواسطة <@${i.user.id}>`, components: [] }).catch(() => {});
    return true;
  }

  if (action === 'reject') {
    await i.deferUpdate();
    const out = await rejectOrder(id, 'الإيصال غير صحيح');
    if (out.error) return true;
    events.emit('order:rejected', id);
    await i.editReply({ content: `❌ تم الرفض بواسطة <@${i.user.id}>`, components: [] }).catch(() => {});
    return true;
  }

  // close
  await update(db => {
    const t = db.tickets.find(x => x.channelId === id);
    if (t) t.status = 'closed';
  });
  await i.reply({ content: 'بيتم إغلاق التذكرة بعد 5 ثواني.' });
  setTimeout(() => i.channel?.delete().catch(() => {}), 5000);
  return true;
}

// الزبون يرسل صورة الإيصال داخل تذكرته
async function onMessage(m) {
  if (m.author.bot || !m.guildId) return;
  const img = m.attachments.find(a => a.contentType?.startsWith('image/'));
  if (!img) return;

  const db = read();
  const t = db.tickets.find(x => x.channelId === m.channelId && x.status === 'open');
  if (!t || t.userId !== m.author.id) return;
  const o = db.orders.find(x => x.id === t.orderId);
  if (!o || o.status !== 'awaiting_receipt') return;

  await update(db => {
    const x = db.orders.find(y => y.id === o.id);
    x.status = 'pending';
    x.receipt = img.url;
    x.receiptAt = Date.now();
  });
  await m.reply('✅ استلمنا الإيصال، جاري المراجعة وبيوصلك الطلب بعد التأكيد.');
  events.emit('order:review', o.id);
}

async function notifyReview(client, id) {
  const o = read().orders.find(x => x.id === id);
  if (!o) return;
  const room = await client.channels.fetch(cfg.discord.merchantRoomId).catch(() => null);
  if (!room) return;

  const e = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`🧾 إيصال جديد — ${o.id}`)
    .addFields(
      { name: 'المنتج', value: o.productName, inline: true },
      { name: 'المبلغ', value: money(o.price), inline: true },
      { name: 'العميل', value: `<@${o.userId}>`, inline: true },
      { name: 'المصدر', value: o.source === 'site' ? 'الموقع' : 'تذكرة ديسكورد', inline: true },
    );

  const files = [];
  if (o.receipt?.startsWith('data:')) {
    files.push(new AttachmentBuilder(Buffer.from(o.receipt.split(',')[1], 'base64'), { name: 'receipt.png' }));
    e.setImage('attachment://receipt.png');
  } else if (o.receipt) {
    e.setImage(o.receipt);
  }

  await room.send({ embeds: [e], files, components: [reviewRow(o.id)] });
}

// يرسل للزبون بالخاص، وإذا الخاص مسكّر يرسله في التذكرة
async function sendToCustomer(client, o, payload) {
  const u = await client.users.fetch(o.userId).catch(() => null);
  const ok = u ? await u.send(payload).then(() => true).catch(() => false) : false;
  if (!ok && o.channelId) {
    const ch = await client.channels.fetch(o.channelId).catch(() => null);
    await ch?.send(payload).catch(() => {});
  }
}

async function notifyDelivered(client, id) {
  const o = read().orders.find(x => x.id === id);
  if (!o) return;
  const e = new EmbedBuilder()
    .setColor(0x2ac55a)
    .setTitle('✅ تم تسليم طلبك')
    .setDescription(`**${o.productName}**\nرقم الطلب: \`${o.id}\``)
    .addFields({ name: 'بيانات المنتج', value: `\`\`\`\n${o.item}\n\`\`\`` });
  await sendToCustomer(client, o, { embeds: [e] });
}

async function notifyRejected(client, id) {
  const o = read().orders.find(x => x.id === id);
  if (!o) return;
  await sendToCustomer(client, o, { content: `❌ تم رفض طلبك ${o.id}. السبب: ${o.reason}` });
}

function wireEvents(client) {
  events.on('order:review', id => notifyReview(client, id).catch(e => console.error('review:', e)));
  events.on('order:delivered', id => notifyDelivered(client, id).catch(e => console.error('deliver:', e)));
  events.on('order:rejected', id => notifyRejected(client, id).catch(e => console.error('reject:', e)));
}

module.exports = { openTicket, handleTicketInteraction, onMessage, wireEvents };
