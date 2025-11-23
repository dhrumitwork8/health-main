class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.ttls = new Map();

        // Cleanup expired entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    set(key, value, ttlMs) {
        this.cache.set(key, value);
        this.ttls.set(key, Date.now() + ttlMs);
    }

    get(key) {
        const expiry = this.ttls.get(key);

        if (!expiry || Date.now() > expiry) {
            this.cache.delete(key);
            this.ttls.delete(key);
            return null;
        }

        return this.cache.get(key);
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        this.cache.delete(key);
        this.ttls.delete(key);
    }

    clear() {
        this.cache.clear();
        this.ttls.clear();
    }

    cleanup() {
        const now = Date.now();
        for (const [key, expiry] of this.ttls.entries()) {
            if (now > expiry) {
                this.cache.delete(key);
                this.ttls.delete(key);
            }
        }
    }

    size() {
        return this.cache.size;
    }
}

export const cache = new SimpleCache();
