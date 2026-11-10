// قناة داخلية بين الموقع والبوت (نفس العملية)
// order:review    -> فيه إيصال جديد ينراجع
// order:delivered -> الطلب انقبل وتم التسليم
// order:rejected  -> الطلب انرفض
module.exports = new (require('events'))();
