/**
 * Consumer 数据生成器 - 数据库模块
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const PRIVATE_DIR = path.join(__dirname, "..", "..", "private", "comsumer-data");
const DB_CONFIG_PATH = path.join(PRIVATE_DIR, "db-config.json");

let pool = null;

/**
 * 加载数据库配置
 */
function loadDbConfig() {
  try {
    const content = fs.readFileSync(DB_CONFIG_PATH, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 获取数据库连接池
 */
async function getPool() {
  if (pool) return pool;

  const config = loadDbConfig();
  if (!config) {
    throw new Error("数据库配置未找到，请检查 private/comsumer-data/db-config.json");
  }

  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    connectTimeout: 30000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  return pool;
}

/**
 * 测试数据库连接
 */
async function testConnection() {
  const p = await getPool();
  const connection = await p.getConnection();
  await connection.ping();
  connection.release();
  return true;
}

/**
 * 获取所有表名
 */
async function listTables() {
  const p = await getPool();
  const [rows] = await p.query("SHOW TABLES");
  return rows.map((row) => Object.values(row)[0]);
}

/**
 * 获取表结构
 */
async function describeTable(tableName) {
  const p = await getPool();
  const [rows] = await p.query("DESCRIBE ??", [tableName]);
  return rows;
}

/**
 * 执行查询
 */
async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.query(sql, params);
  return rows;
}

/**
 * 关闭连接池
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  loadDbConfig,
  getPool,
  testConnection,
  listTables,
  describeTable,
  query,
  closePool,
};
