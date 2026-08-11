const { EventEmitter } = require("events");

// Stand-in do barramento de eventos da spec 03 (Redis Pub/Sub em produção).
// Publica eventos de status por usuário para os assinantes SSE do hub/router.js.
class HubEventBus extends EventEmitter {
  publish(usuarioId, evento) {
    this.emit(`evento:${usuarioId}`, { ...evento, timestamp: new Date().toISOString() });
  }

  subscribe(usuarioId, listener) {
    const canal = `evento:${usuarioId}`;
    this.on(canal, listener);
    return () => this.off(canal, listener);
  }
}

module.exports = new HubEventBus();
