class Logger {
  constructor(callback) {
    this.callback = callback;
  }

  log(message) {
    const log = {
      timestamp: new Date().toISOString(),
      message
    };

    console.log(log);

    if (this.callback) {
      this.callback(log);
    }
  }
}

module.exports = Logger;