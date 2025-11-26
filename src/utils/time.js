export const formatTime12Hour = (time) => {
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    return time; // Return original if formatting fails
  }
};

export const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();
};

export const getLocalDayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
};

export const buildReminderTriggers = (times) => {
  if (!times || !Array.isArray(times)) return [];

  return times.map(time => {
    const [hours, minutes] = time.split(':').map(Number);
    return {
      hour: hours,
      minute: minutes,
      repeats: true,
    };
  });
};
