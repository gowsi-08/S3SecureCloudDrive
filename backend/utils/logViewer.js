const fs = require('fs');
const path = require('path');

// Get logs directory
const getLogsDir = () => {
  return path.join(__dirname, '../logs');
};

// Get current date log file
const getCurrentLogFile = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const filename = `${year}-${month}-${day}.log`;
  return path.join(getLogsDir(), filename);
};

// Read all logs from current day
const readAllLogs = () => {
  try {
    const logFile = getCurrentLogFile();
    if (!fs.existsSync(logFile)) {
      return [];
    }
    
    const content = fs.readFileSync(logFile, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line, timestamp: new Date().toISOString() };
        }
      });
  } catch (error) {
    console.error('Error reading logs:', error);
    return [];
  }
};

// Filter logs by various criteria
const filterLogs = (criteria = {}) => {
  const logs = readAllLogs();
  
  return logs.filter(log => {
    if (criteria.type && log.type !== criteria.type) return false;
    if (criteria.method && log.method !== criteria.method) return false;
    if (criteria.path && !log.path?.includes(criteria.path)) return false;
    if (criteria.status && log.responseStatus !== criteria.status) return false;
    if (criteria.userId && log.userId !== criteria.userId) return false;
    if (criteria.email && log.email !== criteria.email) return false;
    if (criteria.minResponseTime && log.responseTimeMs < criteria.minResponseTime) return false;
    if (criteria.errorOnly && !log.errorMessage) return false;
    return true;
  });
};

// Get logs by endpoint
const getLogsByEndpoint = (path) => {
  return filterLogs({ path });
};

// Get logs by status code
const getLogsByStatus = (status) => {
  return filterLogs({ status });
};

// Get error logs
const getErrorLogs = () => {
  return filterLogs({ type: 'ERROR' });
};

// Get slow requests (> X ms)
const getSlowRequests = (minTime = 1000) => {
  return filterLogs({ minResponseTime: minTime }).filter(log => log.responseTimeMs);
};

// Get request statistics
const getStats = () => {
  const logs = readAllLogs();
  
  const stats = {
    totalRequests: 0,
    totalErrors: 0,
    byMethod: {},
    byEndpoint: {},
    byStatus: {},
    averageResponseTime: 0,
    totalResponseTime: 0,
    slowestRequests: [],
  };
  
  logs.forEach(log => {
    if (log.type === 'HTTP') {
      stats.totalRequests++;
      stats.totalResponseTime += log.responseTimeMs || 0;
      
      // By method
      stats.byMethod[log.method] = (stats.byMethod[log.method] || 0) + 1;
      
      // By endpoint
      stats.byEndpoint[log.path] = (stats.byEndpoint[log.path] || 0) + 1;
      
      // By status
      stats.byStatus[log.responseStatus] = (stats.byStatus[log.responseStatus] || 0) + 1;
      
      // Track slow requests
      if (log.responseTimeMs > 500) {
        stats.slowestRequests.push({
          path: log.path,
          method: log.method,
          time: log.responseTimeMs,
          status: log.responseStatus,
        });
      }
    } else if (log.type === 'ERROR') {
      stats.totalErrors++;
    }
  });
  
  stats.averageResponseTime = stats.totalRequests > 0 
    ? Math.round(stats.totalResponseTime / stats.totalRequests) 
    : 0;
  
  // Sort slowest requests by time
  stats.slowestRequests.sort((a, b) => b.time - a.time).slice(0, 10);
  
  return stats;
};

// Pretty print logs to console
const printLogs = (logs, limit = 50) => {
  console.clear();
  console.log('📋 RECENT LOGS\n');
  
  logs.slice(-limit).forEach(log => {
    if (log.type === 'HTTP') {
      const statusColor = log.responseStatus >= 400 ? '❌' : log.responseStatus >= 300 ? '⚠️' : '✅';
      console.log(
        `${statusColor} [${log.timestamp}] ${log.method.padEnd(6)} ${log.path.padEnd(30)} → ${log.responseStatus} (${log.responseTimeMs}ms)`
      );
    } else if (log.type === 'ERROR') {
      console.log(
        `❌ [${log.timestamp}] ERROR: ${log.errorMessage}`
      );
    }
  });
  
  console.log(`\n📊 Total logs shown: ${Math.min(limit, logs.length)}`);
};

// Pretty print stats
const printStats = () => {
  const stats = getStats();
  
  console.clear();
  console.log('📊 API STATISTICS\n');
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Total Errors: ${stats.totalErrors}`);
  console.log(`Average Response Time: ${stats.averageResponseTime}ms\n`);
  
  console.log('Requests by Method:');
  Object.entries(stats.byMethod).forEach(([method, count]) => {
    console.log(`  ${method}: ${count}`);
  });
  
  console.log('\nTop Endpoints:');
  Object.entries(stats.byEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([endpoint, count]) => {
      console.log(`  ${endpoint}: ${count}`);
    });
  
  console.log('\nResponse Status Distribution:');
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  if (stats.slowestRequests.length > 0) {
    console.log('\n🐌 Top 10 Slowest Requests:');
    stats.slowestRequests.slice(0, 10).forEach(req => {
      console.log(`  ${req.method} ${req.path} → ${req.time}ms`);
    });
  }
};

module.exports = {
  readAllLogs,
  filterLogs,
  getLogsByEndpoint,
  getLogsByStatus,
  getErrorLogs,
  getSlowRequests,
  getStats,
  printLogs,
  printStats,
  getLogsDir,
  getCurrentLogFile,
};
