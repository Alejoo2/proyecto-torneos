const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SLOTS = [
  "00:00 - 02:00", "02:00 - 04:00", "04:00 - 06:00", "06:00 - 08:00",
  "08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00", "14:00 - 16:00",
  "16:00 - 18:00", "18:00 - 20:00", "20:00 - 22:00", "22:00 - 00:00",
];

export function dayLabel(dayOfWeek: number): string {
  return DAYS[dayOfWeek] ?? "";
}

export function slotLabel(timeSlot: number): string {
  return SLOTS[timeSlot] ?? "";
}