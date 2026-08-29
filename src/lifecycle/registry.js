/**
 * Registry Module - Manage secret registry
 * @module lifecycle/registry
 */

import fs from 'fs/promises';
import path from 'path';
import { fileExists, readFile, writeFile } from '../utils/fs.js';
import { generateFingerprint, compareFingerprints } from './fingerprint.js';
import { createLogger } from '../cli/ui/logger.js';

const logger = createLogger();

/**
 * Registry Manager
 */
export class RegistryManager {
  /**
   * Create a registry manager
   * @param {string} projectRoot - Project root directory
   * @param {Object} config - Registry configuration
   */
  constructor(projectRoot, config = {}) {
    this.projectRoot = projectRoot;
    this.config = {
      registryFile: '.secretguard/registry.json',
      fingerprintAlgorithm: 'sha256',
      ...config
    };

    this.registryPath = path.join(projectRoot, this.config.registryFile);
    this.registry = null;
    this.loaded = false;
  }

  /**
   * Load registry from disk
   * @returns {Promise<Object>} Registry data
   */
  async load() {
    if (this.loaded && this.registry) {
      return this.registry;
    }

    if (!(await fileExists(this.registryPath))) {
      this.registry = this.createEmptyRegistry();
      this.loaded = true;
      return this.registry;
    }

    try {
      const content = await readFile(this.registryPath);
      const data = JSON.parse(content);

      // Validate registry structure
      this.registry = this.validateRegistry(data);
      this.loaded = true;
      return this.registry;
    } catch (error) {
      logger.warn(`Failed to load registry: ${error.message}`);
      this.registry = this.createEmptyRegistry();
      this.loaded = true;
      return this.registry;
    }
  }

  /**
   * Save registry to disk
   * @param {Object} registry - Registry data to save
   * @returns {Promise<void>}
   */
  async save(registry = null) {
    const data = registry || this.registry;

    if (!data) {
      throw new Error('No registry data to save');
    }

    // Ensure directory exists
    const dir = path.dirname(this.registryPath);
    await fs.mkdir(dir, { recursive: true });

    // Write registry with pretty formatting
    await writeFile(this.registryPath, JSON.stringify(data, null, 2));
    this.registry = data;
    this.loaded = true;
  }

  /**
   * Create empty registry
   * @returns {Object} Empty registry
   */
  createEmptyRegistry() {
    return {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      secrets: [],
      stats: {
        total: 0,
        migrated: 0,
        active: 0,
        resurrected: 0
      }
    };
  }

  /**
   * Validate registry data
   * @param {Object} data - Registry data to validate
   * @returns {Object} Validated registry
   */
  validateRegistry(data) {
    const defaultRegistry = this.createEmptyRegistry();

    // Ensure required fields exist
    const validated = {
      version: data.version || defaultRegistry.version,
      createdAt: data.createdAt || defaultRegistry.createdAt,
      updatedAt: data.updatedAt || defaultRegistry.updatedAt,
      secrets: Array.isArray(data.secrets) ? data.secrets : [],
      stats: {
        total: data.stats?.total || 0,
        migrated: data.stats?.migrated || 0,
        active: data.stats?.active || 0,
        resurrected: data.stats?.resurrected || 0
      }
    };

    // Validate each secret entry
    validated.secrets = validated.secrets.map(secret => ({
      fingerprint: secret.fingerprint || '',
      type: secret.type || 'unknown',
      firstSeen: secret.firstSeen || new Date().toISOString(),
      lastSeen: secret.lastSeen || new Date().toISOString(),
      status: secret.status || 'active', // active, migrated, resurrected
      file: secret.file || '',
      line: secret.line || 0,
      confidence: secret.confidence || 0,
      context: secret.context || '',
      metadata: secret.metadata || {}
    }));

    return validated;
  }

  /**
   * Add a secret to the registry
   * @param {Object} secret - Secret information
   * @param {string} secret.value - Secret value
   * @param {string} secret.type - Secret type
   * @param {string} secret.file - File path
   * @param {number} secret.line - Line number
   * @param {number} secret.confidence - Confidence score
   * @param {string} secret.context - Context snippet
   * @param {Object} secret.metadata - Additional metadata
   * @returns {Promise<Object>} Added or existing secret entry
   */
  async addSecret(secret) {
    await this.load();

    const { value, type, file, line, confidence, context, metadata = {} } = secret;

    // Generate fingerprint
    const fingerprint = generateFingerprint(value, this.config.fingerprintAlgorithm);

    // Check if secret already exists
    const existing = this.findSecretByFingerprint(fingerprint);

    if (existing) {
      // Update existing entry
      existing.lastSeen = new Date().toISOString();
      existing.file = file || existing.file;
      existing.line = line || existing.line;
      existing.confidence = Math.max(existing.confidence, confidence || 0);

      // Update metadata
      existing.metadata = { ...existing.metadata, ...metadata };

      await this.save();
      return existing;
    }

    // Create new entry
    const entry = {
      fingerprint,
      type,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'active',
      file: file || '',
      line: line || 0,
      confidence: confidence || 0,
      context: context || '',
      metadata
    };

    this.registry.secrets.push(entry);
    this.updateStats();
    await this.save();

    return entry;
  }

  /**
   * Add multiple secrets to the registry
   * @param {Array} secrets - Array of secret information
   * @returns {Promise<Array>} Added secrets
   */
  async addSecrets(secrets) {
    await this.load();
    const results = [];

    for (const secret of secrets) {
      const result = await this.addSecret(secret);
      results.push(result);
    }

    return results;
  }

  /**
   * Find a secret by fingerprint
   * @param {string} fingerprint - Secret fingerprint
   * @returns {Object|null} Secret entry or null
   */
  findSecretByFingerprint(fingerprint) {
    if (!this.registry) {
      return null;
    }

    return this.registry.secrets.find(s => compareFingerprints(s.fingerprint, fingerprint)) || null;
  }

  /**
   * Find a secret by value (using fingerprint comparison)
   * @param {string} value - Secret value
   * @returns {Object|null} Secret entry or null
   */
  findSecretByValue(value) {
    const fingerprint = generateFingerprint(value, this.config.fingerprintAlgorithm);
    return this.findSecretByFingerprint(fingerprint);
  }

  /**
   * Update secret status
   * @param {string} fingerprint - Secret fingerprint
   * @param {string} status - New status (active, migrated, resurrected)
   * @returns {Promise<Object|null>} Updated secret or null
   */
  async updateStatus(fingerprint, status) {
    await this.load();

    const secret = this.findSecretByFingerprint(fingerprint);
    if (!secret) {
      return null;
    }

    secret.status = status;
    secret.lastSeen = new Date().toISOString();

    this.updateStats();
    await this.save();

    return secret;
  }

  /**
   * Mark secret as migrated
   * @param {string} fingerprint - Secret fingerprint
   * @param {Object} migrationInfo - Migration information
   * @returns {Promise<Object|null>} Updated secret or null
   */
  async markAsMigrated(fingerprint, migrationInfo = {}) {
    const secret = await this.updateStatus(fingerprint, 'migrated');

    if (secret) {
      secret.metadata = {
        ...secret.metadata,
        migratedAt: new Date().toISOString(),
        migrationInfo
      };
      await this.save();
    }

    return secret;
  }

  /**
   * Mark secret as resurrected
   * @param {string} fingerprint - Secret fingerprint
   * @param {Object} context - Resurrection context
   * @returns {Promise<Object|null>} Updated secret or null
   */
  async markAsResurrected(fingerprint, context = {}) {
    const secret = await this.updateStatus(fingerprint, 'resurrected');

    if (secret) {
      secret.metadata = {
        ...secret.metadata,
        resurrectedAt: new Date().toISOString(),
        resurrectionContext: context
      };
      await this.save();
    }

    return secret;
  }

  /**
   * Get all secrets by status
   * @param {string} status - Status filter (active, migrated, resurrected)
   * @returns {Array} Filtered secrets
   */
  getSecretsByStatus(status) {
    if (!this.registry) {
      return [];
    }

    return this.registry.secrets.filter(s => s.status === status);
  }

  /**
   * Get all active secrets
   * @returns {Array} Active secrets
   */
  getActiveSecrets() {
    return this.getSecretsByStatus('active');
  }

  /**
   * Get all migrated secrets
   * @returns {Array} Migrated secrets
   */
  getMigratedSecrets() {
    return this.getSecretsByStatus('migrated');
  }

  /**
   * Get all resurrected secrets
   * @returns {Array} Resurrected secrets
   */
  getResurrectedSecrets() {
    return this.getSecretsByStatus('resurrected');
  }

  /**
   * Update registry statistics
   * @returns {void}
   */
  updateStats() {
    if (!this.registry) {
      return;
    }

    this.registry.stats.total = this.registry.secrets.length;
    this.registry.stats.migrated = this.getMigratedSecrets().length;
    this.registry.stats.active = this.getActiveSecrets().length;
    this.registry.stats.resurrected = this.getResurrectedSecrets().length;
    this.registry.updatedAt = new Date().toISOString();
  }

  /**
   * Get registry statistics
   * @returns {Object} Statistics
   */
  getStats() {
    if (!this.registry) {
      return {
        total: 0,
        migrated: 0,
        active: 0,
        resurrected: 0
      };
    }

    return { ...this.registry.stats };
  }

  /**
   * Check if a secret has been seen before
   * @param {string} value - Secret value
   * @returns {boolean} Whether secret has been seen
   */
  hasSecretBeenSeen(value) {
    const fingerprint = generateFingerprint(value, this.config.fingerprintAlgorithm);
    return this.findSecretByFingerprint(fingerprint) !== null;
  }

  /**
   * Check if a secret was previously migrated
   * @param {string} value - Secret value
   * @returns {boolean} Whether secret was previously migrated
   */
  wasSecretPreviouslyMigrated(value) {
    const fingerprint = generateFingerprint(value, this.config.fingerprintAlgorithm);
    const secret = this.findSecretByFingerprint(fingerprint);
    return secret ? secret.status === 'migrated' : false;
  }

  /**
   * Check if a secret is resurrected
   * @param {string} value - Secret value
   * @returns {boolean} Whether secret is resurrected
   */
  isSecretResurrected(value) {
    const fingerprint = generateFingerprint(value, this.config.fingerprintAlgorithm);
    const secret = this.findSecretByFingerprint(fingerprint);
    return secret ? secret.status === 'resurrected' : false;
  }

  /**
   * Clear registry (delete all entries)
   * @param {boolean} confirm - Confirmation flag
   * @returns {Promise<void>}
   */
  async clear(confirm = false) {
    if (!confirm) {
      throw new Error('Clear operation requires confirmation');
    }

    this.registry = this.createEmptyRegistry();
    await this.save();
  }

  /**
   * Export registry data
   * @returns {Object} Registry data
   */
  exportRegistry() {
    if (!this.registry) {
      return null;
    }

    // Remove sensitive data (only keep metadata)
    return {
      version: this.registry.version,
      createdAt: this.registry.createdAt,
      updatedAt: this.registry.updatedAt,
      stats: this.registry.stats,
      secrets: this.registry.secrets.map(s => ({
        fingerprint: s.fingerprint,
        type: s.type,
        firstSeen: s.firstSeen,
        lastSeen: s.lastSeen,
        status: s.status,
        file: s.file,
        line: s.line,
        confidence: s.confidence,
        metadata: s.metadata
      }))
    };
  }

  /**
   * Import registry data
   * @param {Object} data - Registry data to import
   * @param {boolean} merge - Whether to merge or replace
   * @returns {Promise<void>}
   */
  async importRegistry(data, merge = false) {
    await this.load();

    const imported = this.validateRegistry(data);

    if (merge) {
      // Merge secrets, avoiding duplicates
      const existingFingerprints = new Set(this.registry.secrets.map(s => s.fingerprint));

      for (const secret of imported.secrets) {
        if (!existingFingerprints.has(secret.fingerprint)) {
          this.registry.secrets.push(secret);
          existingFingerprints.add(secret.fingerprint);
        }
      }
    } else {
      this.registry = imported;
    }

    this.updateStats();
    await this.save();
  }
}

export default RegistryManager;
