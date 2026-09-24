/** Уақыт белгісі (timestamp) бар бағандар үшін: бүгінгі жергілікті күннің басы мен соңы. */
export function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * MenuItem.date (@db.Date) үшін: бүгінгі жергілікті күн, UTC түн ортасы түрінде.
 * Prisma @db.Date сүзгісіндегі уақытты UTC күнге дейін қияды, сондықтан todayRange()
 * UTC+5/+6 аймағында кешегі мәзірді де қамтып кетеді.
 */
export function todayDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
