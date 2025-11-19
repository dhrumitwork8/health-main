/**
 * Formats database connection errors into user-friendly messages
 * @param {Error} err - The database error object
 * @returns {string} - Formatted error message
 */
export const formatDbError = (err) => {
  const dbHost = process.env.DB_HOST || "unknown";
  const dbPort = process.env.DB_PORT || "unknown";
  
  // Handle specific error codes
  switch (err.code) {
    case "EHOSTUNREACH":
      return `Database connection failed: Cannot reach database server at ${dbHost}:${dbPort}. The host may be unreachable, or there may be a network/firewall issue.`;
    
    case "ECONNREFUSED":
      return `Database connection refused: The database server at ${dbHost}:${dbPort} is not accepting connections. Check if PostgreSQL is running and configured to accept connections.`;
    
    case "ETIMEDOUT":
      return `Database connection timeout: Could not connect to ${dbHost}:${dbPort} within the timeout period. The server may be down or unreachable.`;
    
    case "ENOTFOUND":
      return `Database hostname not found: Cannot resolve hostname "${dbHost}". Check your DNS configuration or use an IP address instead.`;
    
    case "EAI_AGAIN":
      return `Database DNS lookup failed: Temporary DNS resolution failure for "${dbHost}". Try using an IP address instead of a hostname.`;
    
    case "28P01":
      return `Database authentication failed: Invalid username or password for database at ${dbHost}:${dbPort}.`;
    
    case "3D000":
      return `Database not found: The database "${process.env.DB_NAME}" does not exist on ${dbHost}:${dbPort}.`;
    
    case "28000":
      return `Database access denied: The user does not have permission to access the database at ${dbHost}:${dbPort}.`;
    
    default:
      // For other errors, provide the original message with context
      if (err.message) {
        return `Database error: ${err.message} (connecting to ${dbHost}:${dbPort})`;
      }
      return `Database connection error: Unable to connect to ${dbHost}:${dbPort}. Error code: ${err.code || "UNKNOWN"}`;
  }
};

/**
 * Sends a standardized database error response
 * @param {Object} reply - Fastify reply object
 * @param {Error} err - The database error
 * @param {Object} fastify - Fastify instance for logging
 */
export const sendDbErrorResponse = (reply, err, fastify) => {
  const errorMessage = formatDbError(err);
  
  // Log detailed error for debugging
  fastify.log.error("Database error:", {
    message: err.message,
    code: err.code,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    stack: err.stack,
  });
  
  reply.code(500).send({
    error: "Internal Server Error",
    details: errorMessage,
    hint: "Check your database configuration and ensure the database server is accessible from this application server.",
  });
};

