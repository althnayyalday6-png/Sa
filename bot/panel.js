// لوحة الشراء الذاتي: تصفح المنتجات + اختيار المنتج + زر ابدأ + ربط الحساب
const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');
const cfg = require('../server/config');
const { read } = require('../server/db');
const tickets = require('./tickets');

const LINK = () => `${cfg.baseUrl}/auth/login`;

const panelCommand = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('نشر لوحة الشراء الذاتي')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .toJSON();

function productsEmbed() {
  const ps = read().products;
  const desc = 'اختر المنتج من زر **تصفح المنتجات**، وبعدها اضغط **ابدأ** وتنفتح لك تذكرة خاصة للدفع.\nلازم تربط حسابك بالموقع قبل الشراء.';
  const e = new EmbedBuilder()
    .setColor(0x2ac55a)
    .setTitle('🛒 الشراء الذاتي — أوربت ستور')
    .setDescription(ps.length ? desc : desc + '\n\n_ما فيه منتجات حالياً_');
  ps.slice(0, 25).forEach(p => e.addFields({
    name: `${p.name} — ${p.price} ريال`,
    value: `${p.desc || '—'}\nالمتوفر: **${p.stock.length}**`,
  }));
  return e;
}

const panelRow = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('orbit:browse').setLabel('تصفح المنتجات').setEmoji('🛍️').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('orbit:refresh').setLabel('تحديث').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setLabel('ربط حسابي').setStyle(ButtonStyle.Link).setURL(LINK()),
);

async function registerPanel(i) {
  await i.channel.send({ embeds: [productsEmbed()], components: [panelRow()] });
  return i.reply({ content: '✅ تم نشر لوحة الشراء الذاتي', ephemeral: true });
}

// يرجع true إذا تعامل مع التفاعل
async function handlePanel(i) {
  if (i.isButton() && i.customId === 'orbit:refresh') {
    await i.update({ embeds: [productsEmbed()] });
    return true;
  }

  if (i.isButton() && i.customId === 'orbit:browse') {
    const ps = read().products.slice(0, 25);
    if (!ps.length) {
      await i.reply({ content: 'ما فيه منتجات حالياً', ephemeral: true });
      return true;
    }
    const menu = new StringSelectMenuBuilder()
      .setCustomId('orbit:pick')
      .setPlaceholder('اختر المنتج')
      .addOptions(ps.map(p => ({
        label: p.name.slice(0, 100),
        description: `${p.price} ريال • متوفر ${p.stock.length}`.slice(0, 100),
        value: p.id,
      })));
    await i.reply({
      content: 'اختر المنتج اللي تبيه:',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
    return true;
  }

  if (i.isStringSelectMenu() && i.customId === 'orbit:pick') {
    const p = read().products.find(x => x.id === i.values[0]);
    if (!p) {
      await i.update({ content: 'المنتج ما عاد موجود', embeds: [], components: [] });
      return true;
    }
    const e = new EmbedBuilder()
      .setColor(0x2ac55a)
      .setTitle(p.name)
      .setDescription(`${p.desc || ''}\n\n**السعر:** ${p.price} ريال\n**المتوفر:** ${p.stock.length}`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`orbit:start:${p.id}`)
        .setLabel('ابدأ')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!p.stock.length),
      new ButtonBuilder().setLabel('ربط حسابي').setStyle(ButtonStyle.Link).setURL(LINK()),
    );
    await i.update({ content: '', embeds: [e], components: [row] });
    return true;
  }

  if (i.isButton() && i.customId.startsWith('orbit:start:')) {
    await tickets.openTicket(i, i.customId.split(':')[2]);
    return true;
  }

  return false;
}

module.exports = { panelCommand, registerPanel, handlePanel };
