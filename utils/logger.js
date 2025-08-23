// Logger utility for better debugging and monitoring
class Logger {
  constructor(context = 'CommitWarrior') {
    this.context = context;
    this.logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  }

  _formatMessage(level, message, extra = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
    
    if (extra) {
      return `${prefix} ${message} ${JSON.stringify(extra, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  debug(message, extra = null) {
    if (this.logLevel === 'debug') {
      console.log(this._formatMessage('debug', message, extra));
    }
  }

  info(message, extra = null) {
    console.log(this._formatMessage('info', message, extra));
  }

  warn(message, extra = null) {
    console.warn(this._formatMessage('warn', message, extra));
  }

  error(message, extra = null) {
    console.error(this._formatMessage('error', message, extra));
  }

  // Log performance metrics
  time(label) {
    console.time(`[${this.context}] ${label}`);
  }

  timeEnd(label) {
    console.timeEnd(`[${this.context}] ${label}`);
  }

  // Log GitHub API rate limit info
  logRateLimit(rateLimitData) {
    if (rateLimitData && rateLimitData.resources) {
      const core = rateLimitData.resources.core;
      this.info(`Rate limit - Remaining: ${core.remaining}/${core.limit}, Reset: ${new Date(core.reset * 1000).toLocaleTimeString()}`);
      
      if (core.remaining < 100) {
        this.warn('GitHub API rate limit is getting low', { remaining: core.remaining, limit: core.limit });
      }
    }
  }

  // Log commit check results
  logCommitResult(result) {
    const logData = {
      success: result.success,
      hasCommitted: result.hasCommitted,
      commitCount: result.commitCount,
      streak: result.streak,
      method: result.method,
      cached: result.cached
    };
    
    if (result.success) {
      this.info('Commit check completed', logData);
    } else {
      this.error('Commit check failed', { ...logData, error: result.error, message: result.message });
    }
  }

  // Log system information
  logSystemInfo() {
    this.info('System Information', {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset()
    });
  }
}

module.exports = Logger;