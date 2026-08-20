import { BadmintonEvent, FeeCollection } from '../types';

export const getLocalDateString = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isDatePast = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  return dateStr < getLocalDateString();
};

export const isFeeCollectionOpen = (collection?: FeeCollection): boolean => {
  if (!collection || collection.status !== 'active') return false;
  return !isDatePast(collection.due_date);
};

/**
 * Strips seconds from time string, e.g. "19:00:00" -> "19:00"
 */
export const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return timeStr;
};

/**
 * Formats start and end times cleanly, e.g. "19:00 - 22:00"
 */
export const formatTimeRange = (startTime?: string, endTime?: string): string => {
  const start = formatTime(startTime);
  const end = formatTime(endTime);
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  return '';
};

/**
 * Formats date into "8/21 (週五)" format
 */
export const formatDateWeekdayCN = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month - 1, day);
    const weekDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const weekDay = weekDays[d.getDay()] || '';
    return `${month}/${day} (${weekDay})`;
  } catch {
    return dateStr;
  }
};

/**
 * Formats time into "下午07:00" format
 */
export const formatTimePeriodCN = (timeStr?: string): string => {
  if (!timeStr) return '';
  try {
    const timeParts = timeStr.trim().split(':');
    if (timeParts.length >= 1) {
      const h = parseInt(timeParts[0], 10);
      const m = timeParts[1] ? timeParts[1].padStart(2, '0') : '00';
      const period = h < 12 ? '上午' : '下午';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${period} ${String(displayHour).padStart(2, '0')}:${m}`;
    }
    return timeStr;
  } catch {
    return timeStr;
  }
};

/**
 * Formats event date and time in Chinese format, e.g. "8/18（週二） 下午07:00"
 */
export const formatEventDateTimeCN = (dateStr?: string, timeStr?: string): string => {
  if (!dateStr) return '尚無排定活動';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month - 1, day);
    const weekDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const weekDay = weekDays[d.getDay()] || '';

    let timeFormatted = '';
    if (timeStr) {
      const timeParts = timeStr.trim().split(':');
      if (timeParts.length >= 1) {
        const h = parseInt(timeParts[0], 10);
        const m = timeParts[1] ? timeParts[1].padStart(2, '0') : '00';
        const period = h < 12 ? '上午' : '下午';
        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        timeFormatted = ` ${period}${String(displayHour).padStart(2, '0')}:${m}`;
      }
    }

    return `${month}/${day}（${weekDay}）${timeFormatted}`;
  } catch {
    return dateStr;
  }
};

export const formatFullDateCN = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

export const isEventPast = (evt: BadmintonEvent): boolean => {
  if (!evt || !evt.event_date) return false;

  const timeStr = evt.end_time || evt.start_time || '23:59:59';
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;

  const dateTimeString = `${evt.event_date}T${normalizedTime}`;
  const eventTime = new Date(dateTimeString).getTime();

  if (isNaN(eventTime)) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return evt.event_date < todayStr;
  }

  return eventTime < Date.now();
};
