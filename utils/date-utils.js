// Utility functions for date and time handling
class DateUtils {
  // Get user's timezone offset in minutes
  static getUserTimezoneOffset() {
    return new Date().getTimezoneOffset();
  }

  // Get today's date in user's local timezone in YYYY-MM-DD format
  static getTodayInUserTimezone() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Get yesterday's date in user's local timezone
  static getYesterdayInUserTimezone() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Convert date to start of day in UTC (for API calls)
  static getStartOfDayUTC(dateString) {
    return `${dateString}T00:00:00Z`;
  }

  // Convert date to end of day in UTC (for API calls)
  static getEndOfDayUTC(dateString) {
    return `${dateString}T23:59:59Z`;
  }

  // Get date from ISO string in user's timezone
  static getDateFromISOString(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Check if a date string represents today
  static isToday(dateString) {
    return dateString === this.getTodayInUserTimezone();
  }

  // Check if a date string represents yesterday
  static isYesterday(dateString) {
    return dateString === this.getYesterdayInUserTimezone();
  }

  // Get the date N days ago
  static getDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Get array of dates for the last N days (including today)
  static getLastNDays(n) {
    const dates = [];
    for (let i = 0; i < n; i++) {
      dates.push(this.getDaysAgo(i));
    }
    return dates.reverse(); // Return in chronological order
  }

  // Calculate days between two date strings
  static daysBetween(dateString1, dateString2) {
    const date1 = new Date(dateString1);
    const date2 = new Date(dateString2);
    const diffTime = Math.abs(date2 - date1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Check if two dates are consecutive
  static areConsecutiveDays(dateString1, dateString2) {
    return this.daysBetween(dateString1, dateString2) === 1;
  }

  // Format date for display
  static formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Get relative time string (e.g., "2 hours ago", "yesterday")
  static getRelativeTimeString(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return this.formatDateForDisplay(isoString);
    }
  }
}

module.exports = DateUtils;