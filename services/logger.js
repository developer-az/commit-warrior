const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class Logger {
  constructor() {
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    
    this.currentLevel = this.logLevels.INFO;
    this.logs = [];
    this.maxLogs = 1000;
    
    // Create logs directory if it doesn't exist
    try {
      const userDataPath = app.getPath('userData');
      this.logsDir = path.join(userDataPath, 'logs');
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  setLevel(level) {
    this.currentLevel = typeof level === 'string' ? this.logLevels[level] : level;
  }

  log(level, message, data = null) {
    if (this.logLevels[level] > this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    // Keep in-memory logs
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output
    const logMessage = `[${timestamp}] ${level}: ${message}`;
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }

    // Write to file (async, non-blocking)
    this.writeToFile(logEntry).catch(err => 
      console.error('Failed to write log to file:', err)
    );
  }

  async writeToFile(logEntry) {
    if (!this.logsDir) return;

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logsDir, `commit-warrior-${today}.log`);
    
    const logLine = `[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}`;
    const dataLine = logEntry.data ? `\n  Data: ${JSON.stringify(logEntry.data, null, 2)}` : '';
    const fullLine = logLine + dataLine + '\n';

    try {
      await fs.promises.appendFile(logFile, fullLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  debug(message, data) {
    this.log('DEBUG', message, data);
  }

  getLogs(level = null, limit = 100) {
    let filteredLogs = this.logs;
    
    if (level) {
      const levelValue = this.logLevels[level];
      filteredLogs = this.logs.filter(log => this.logLevels[log.level] <= levelValue);
    }
    
    return filteredLogs.slice(-limit);
  }

  clearLogs() {
    this.logs = [];
  }
}

module.exports = new Logger();