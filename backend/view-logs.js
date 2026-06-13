#!/usr/bin/env node

/**
 * CLI Tool for Viewing and Analyzing Logs
 * 
 * Usage:
 *   node view-logs.js all              - Show all logs
 *   node view-logs.js stats            - Show statistics
 *   node view-logs.js errors           - Show error logs
 *   node view-logs.js slow [time]      - Show slow requests (default: 1000ms)
 *   node view-logs.js endpoint [path]  - Show logs for specific endpoint
 *   node view-logs.js status [code]    - Show logs with specific status code
 *   node view-logs.js user [email]     - Show logs for specific user
 *   node view-logs.js follow           - Follow logs in real-time
 */

const logViewer = require('./utils/logViewer');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Format log entry for display
const formatLog = (log) => {
  if (log.type === 'HTTP') {
    const statusColor = log.responseStatus >= 400 ? colors.red : log.responseStatus >= 300 ? colors.yellow : colors.green;
    const statusEmoji = log.responseStatus >= 400 ? '❌' : log.responseStatus >= 300 ? '⚠️' : '✅';
    
    return `${statusEmoji} ${colors.cyan}[${log.timestamp}]${colors.reset} ${log.method.padEnd(6)} ${log.path.padEnd(40)} ${statusColor}${log.responseStatus}${colors.reset} ${colors.bright}(${log.responseTimeMs}ms)${colors.reset} ${log.clientIP}`;
  } else if (log.type === 'ERROR') {
    return `❌ ${colors.red}[${log.timestamp}] ERROR${colors.reset}: ${log.errorMessage} at ${log.path}`;
  } else if (log.type === 'UNCAUGHT_EXCEPTION') {
    return `💥 ${colors.red}[${log.timestamp}] UNCAUGHT EXCEPTION${colors.reset}: ${log.errorMessage}`;
  } else if (log.type === 'UNHANDLED_REJECTION') {
    return `⚠️  ${colors.yellow}[${log.timestamp}] UNHANDLED REJECTION${colors.reset}: ${log.reason}`;
  }
  
  return `${log.timestamp}: ${log.raw || JSON.stringify(log)}`;
};

// Print header
const printHeader = (title) => {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title.padStart((title.length + 80) / 2)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);
};

// Command handlers
const commands = {
  all: () => {
    const logs = logViewer.readAllLogs();
    printHeader('📋 ALL LOGS');
    
    if (logs.length === 0) {
      console.log('No logs found. Start the server and make some requests!');
      return;
    }
    
    logs.slice(-100).forEach(log => console.log(formatLog(log)));
    console.log(`\n${colors.bright}Total: ${logs.length} logs${colors.reset}`);
  },

  stats: () => {
    const stats = logViewer.getStats();
    printHeader('📊 STATISTICS');
    
    console.log(`${colors.bright}Total Requests:${colors.reset} ${colors.green}${stats.totalRequests}${colors.reset}`);
    console.log(`${colors.bright}Total Errors:${colors.reset} ${colors.red}${stats.totalErrors}${colors.reset}`);
    console.log(`${colors.bright}Average Response Time:${colors.reset} ${stats.averageResponseTime}ms\n`);
    
    console.log(`${colors.bright}Requests by Method:${colors.reset}`);
    Object.entries(stats.byMethod).forEach(([method, count]) => {
      console.log(`  ${method.padEnd(6)} ${colors.cyan}${count}${colors.reset}`);
    });
    
    console.log(`\n${colors.bright}Top Endpoints:${colors.reset}`);
    Object.entries(stats.byEndpoint)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([endpoint, count]) => {
        console.log(`  ${endpoint.padEnd(40)} ${colors.cyan}${count}${colors.reset}`);
      });
    
    console.log(`\n${colors.bright}Response Status Distribution:${colors.reset}`);
    Object.entries(stats.byStatus).forEach(([status, count]) => {
      const statusColor = status >= 400 ? colors.red : status >= 300 ? colors.yellow : colors.green;
      console.log(`  ${statusColor}${status}${colors.reset}     ${colors.cyan}${count}${colors.reset}`);
    });
    
    if (stats.slowestRequests.length > 0) {
      console.log(`\n${colors.bright}🐌 Slowest Requests:${colors.reset}`);
      stats.slowestRequests.slice(0, 10).forEach(req => {
        console.log(`  ${req.method.padEnd(6)} ${req.path.padEnd(40)} ${colors.yellow}${req.time}ms${colors.reset}`);
      });
    }
  },

  errors: () => {
    const errors = logViewer.getErrorLogs();
    printHeader('❌ ERROR LOGS');
    
    if (errors.length === 0) {
      console.log(`${colors.green}No errors! Everything is working fine!${colors.reset}`);
      return;
    }
    
    errors.slice(-50).forEach(log => console.log(formatLog(log)));
    console.log(`\n${colors.bright}Total: ${errors.length} errors${colors.reset}`);
  },

  slow: (minTime) => {
    const time = parseInt(minTime) || 1000;
    const slow = logViewer.getSlowRequests(time);
    printHeader(`🐌 SLOW REQUESTS (> ${time}ms)`);
    
    if (slow.length === 0) {
      console.log(`${colors.green}No slow requests! All requests are fast.${colors.reset}`);
      return;
    }
    
    slow.slice(-50).forEach(log => console.log(formatLog(log)));
    console.log(`\n${colors.bright}Total: ${slow.length} slow requests${colors.reset}`);
  },

  endpoint: (pathPattern) => {
    if (!pathPattern) {
      console.log('Usage: node view-logs.js endpoint [path]');
      console.log('Example: node view-logs.js endpoint /api/auth');
      return;
    }
    
    const logs = logViewer.getLogsByEndpoint(pathPattern);
    printHeader(`🔍 LOGS FOR ENDPOINT: ${pathPattern}`);
    
    if (logs.length === 0) {
      console.log(`No logs found for endpoint: ${pathPattern}`);
      return;
    }
    
    logs.slice(-50).forEach(log => console.log(formatLog(log)));
    console.log(`\n${colors.bright}Total: ${logs.length} requests${colors.reset}`);
  },

  status: (statusCode) => {
    if (!statusCode) {
      console.log('Usage: node view-logs.js status [code]');
      console.log('Example: node view-logs.js status 404');
      return;
    }
    
    const logs = logViewer.getLogsByStatus(parseInt(statusCode));
    printHeader(`📍 LOGS WITH STATUS ${statusCode}`);
    
    if (logs.length === 0) {
      console.log(`No logs found with status code: ${statusCode}`);
      return;
    }
    
    logs.slice(-50).forEach(log => console.log(formatLog(log)));
    console.log(`\n${colors.bright}Total: ${logs.length} requests${colors.reset}`);
  },

  user: (email) => {
    if (!email) {
      console.log('Usage: node view-logs.js user [email]');
      console.log('Example: node view-logs.js user john@example.com');
      return;
    }
    
    const allLogs = logViewer.readAllLogs();
    const userLogs = allLogs.filter(l => l.email === email || l.userId === email);
    
    printHeader(`👤 LOGS FOR USER: ${email}`);
    
    if (userLogs.length === 0) {
      console.log(`No logs found for user: ${email}`);
      return;
    }
    
    userLogs.slice(-50).forEach(log => console.log(formatLog(log)));
    console.log(`\n${colors.bright}Total: ${userLogs.length} requests${colors.reset}`);
  },

  follow: () => {
    printHeader('📡 FOLLOWING LOGS (Real-time)');
    console.log('Press Ctrl+C to stop\n');
    
    let lastRead = 0;
    setInterval(() => {
      const logs = logViewer.readAllLogs();
      const newLogs = logs.slice(lastRead);
      
      newLogs.forEach(log => {
        console.log(formatLog(log));
      });
      
      lastRead = logs.length;
    }, 1000);
  },

  help: () => {
    printHeader('📚 HELP');
    console.log(`${colors.bright}Available Commands:${colors.reset}\n`);
    console.log(`  ${colors.cyan}all${colors.reset}              Show all logs`);
    console.log(`  ${colors.cyan}stats${colors.reset}            Show statistics`);
    console.log(`  ${colors.cyan}errors${colors.reset}           Show error logs`);
    console.log(`  ${colors.cyan}slow${colors.reset} [time]      Show slow requests (default: 1000ms)`);
    console.log(`  ${colors.cyan}endpoint${colors.reset} [path]  Show logs for specific endpoint`);
    console.log(`  ${colors.cyan}status${colors.reset} [code]    Show logs with specific status code`);
    console.log(`  ${colors.cyan}user${colors.reset} [email]     Show logs for specific user`);
    console.log(`  ${colors.cyan}follow${colors.reset}           Follow logs in real-time`);
    console.log(`  ${colors.cyan}help${colors.reset}             Show this help message\n`);
    console.log(`${colors.bright}Examples:${colors.reset}\n`);
    console.log(`  node view-logs.js all`);
    console.log(`  node view-logs.js stats`);
    console.log(`  node view-logs.js errors`);
    console.log(`  node view-logs.js slow 2000`);
    console.log(`  node view-logs.js endpoint /api/auth`);
    console.log(`  node view-logs.js status 404`);
    console.log(`  node view-logs.js user john@example.com`);
    console.log(`  node view-logs.js follow\n`);
  }
};

// Parse command line arguments
const command = process.argv[2] || 'help';
const arg = process.argv[3];

// Execute command
if (commands[command]) {
  try {
    commands[command](arg);
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
} else {
  console.log(`${colors.red}Unknown command: ${command}${colors.reset}`);
  console.log(`Run 'node view-logs.js help' for available commands\n`);
  process.exit(1);
}
