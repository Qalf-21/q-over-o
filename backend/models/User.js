/**
 * User Model
 * Defines the user schema and data access methods
 */

const { users } = require('../config/supabase');
const bcrypt = require('bcryptjs');

class User {
  constructor(userData) {
    this.id = userData.id || Date.now().toString();
    this.name = userData.name;
    this.email = userData.email;
    this.password_hash = userData.password_hash;
    this.role = userData.role || 'tutee';
    this.createdAt = userData.createdAt || new Date();
  }

  /**
   * Create a new user
   */
  static async create(userData) {
    // Check if email already exists
    const existingUser = users.find(u => u.email === userData.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(userData.password, salt);

    const newUser = new User({
      ...userData,
      password_hash,
      role: userData.role || 'tutee'
    });

    users.push(newUser);
    return newUser;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    return users.find(u => u.email === email) || null;
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    return users.find(u => u.id === id) || null;
  }

  /**
   * Compare password
   */
  async comparePassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }

  /**
   * Return user without sensitive data
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt
    };
  }
}

module.exports = User;