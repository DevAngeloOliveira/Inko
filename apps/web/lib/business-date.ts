const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function businessDate(instant = new Date()): string {
  return calendar.format(instant);
}
