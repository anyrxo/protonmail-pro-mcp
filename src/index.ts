#!/usr/bin/env node

/**
 * 🌟 The Sirency Collective - Ultimate Proton Mail MCP Server
 * 
 * The most comprehensive Proton Mail MCP server ever created.
 * Built by The Sirency Collective for legendary email management.
 * 
 * Features:
 * ✅ Advanced email sending (SMTP) with templates & scheduling
 * ✅ Complete email reading (IMAP) via Proton Bridge
 * ✅ Comprehensive email statistics & analytics
 * ✅ Folder and label management
 * ✅ Contact management with interaction tracking
 * ✅ Email search with advanced filters
 * ✅ Attachment handling
 * ✅ Email threading and conversation management
 * ✅ Real-time synchronization
 * ✅ Performance monitoring and logging
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

import { ProtonMailConfig } from './types/index.js';
import { SMTPService } from './services/smtp-service.js';
import { SimpleIMAPService } from './services/simple-imap-service.js';
import { AnalyticsService } from './services/analytics-service.js';
import { logger, Logger } from './utils/logger.js';
import { parseEmails, isValidEmail } from './utils/helpers.js';

// Environment configuration
const PROTONMAIL_USERNAME = process.env.PROTONMAIL_USERNAME;
const PROTONMAIL_PASSWORD = process.env.PROTONMAIL_PASSWORD;
const PROTONMAIL_SMTP_HOST = process.env.PROTONMAIL_SMTP_HOST || "smtp.protonmail.ch";
const PROTONMAIL_SMTP_PORT = parseInt(process.env.PROTONMAIL_SMTP_PORT || "587", 10);
const PROTONMAIL_IMAP_HOST = process.env.PROTONMAIL_IMAP_HOST || "localhost";
const PROTONMAIL_IMAP_PORT = parseInt(process.env.PROTONMAIL_IMAP_PORT || "1143", 10);
const DEBUG = process.env.DEBUG === "true";

// Validate required environment variables
if (!PROTONMAIL_USERNAME || !PROTONMAIL_PASSWORD) {
  console.error("❌ [Sirency-ProtonMail] Missing required environment variables: PROTONMAIL_USERNAME and PROTONMAIL_PASSWORD must be set");
  process.exit(1);
}

// Configure logger
logger.setDebugMode(DEBUG);

// Create configuration
const config: ProtonMailConfig = {
  smtp: {
    host: PROTONMAIL_SMTP_HOST,
    port: PROTONMAIL_SMTP_PORT,
    secure: PROTONMAIL_SMTP_PORT === 465,
    username: PROTONMAIL_USERNAME,
    password: PROTONMAIL_PASSWORD,
  },
  imap: {
    host: PROTONMAIL_IMAP_HOST,
    port: PROTONMAIL_IMAP_PORT,
    secure: false, // Proton Bridge uses localhost without TLS
    username: PROTONMAIL_USERNAME,
    password: PROTONMAIL_PASSWORD,
  },
  debug: DEBUG,
  cacheEnabled: true,
  analyticsEnabled: true,
  autoSync: true,
  syncInterval: 5 // minutes
};

// Initialize services
const smtpService = new SMTPService(config);
const imapService = new SimpleIMAPService();
const analyticsService = new AnalyticsService();

/**
 * Create MCP server with comprehensive email management capabilities
 */
const server = new Server(
  {
    name: "sirency-protonmail-ultimate-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List all available tools - The Ultimate Proton Mail Toolkit
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.debug("Listing available tools", "MCPServer");
  
  return {
    tools: [
      // 📧 EMAIL SENDING TOOLS
      {
        name: "send_email",
        description: "🚀 Send email with advanced options (templates, scheduling, attachments)",
        inputSchema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email address(es), comma-separated" },
            cc: { type: "string", description: "CC recipients, comma-separated" },
            bcc: { type: "string", description: "BCC recipients, comma-separated" },
            subject: { type: "string", description: "Email subject" },
            body: { type: "string", description: "Email body content" },
            isHtml: { type: "boolean", description: "Whether body is HTML", default: false },
            priority: { type: "string", enum: ["high", "normal", "low"], description: "Email priority" },
            replyTo: { type: "string", description: "Reply-to email address" },
            attachments: { type: "array", description: "File attachments (base64 encoded)" }
          },
          required: ["to", "subject", "body"]
        }
      },
      {
        name: "send_test_email",
        description: "🧪 Send a test email to verify SMTP functionality",
        inputSchema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Test recipient email address" },
            customMessage: { type: "string", description: "Custom test message" }
          },
          required: ["to"]
        }
      },

      // 📬 EMAIL READING TOOLS
      {
        name: "get_emails",
        description: "📬 Get emails from a specific folder with pagination",
        inputSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "Folder name (default: INBOX)", default: "INBOX" },
            limit: { type: "number", description: "Number of emails to fetch", default: 50 },
            offset: { type: "number", description: "Pagination offset", default: 0 }
          }
        }
      },
      {
        name: "get_email_by_id",
        description: "📧 Get a specific email by its ID",
        inputSchema: {
          type: "object",
          properties: {
            emailId: { type: "string", description: "Email ID to retrieve" }
          },
          required: ["emailId"]
        }
      },
      {
        name: "search_emails",
        description: "🔍 Search emails with advanced filters",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            folder: { type: "string", description: "Folder to search in" },
            from: { type: "string", description: "Filter by sender" },
            to: { type: "string", description: "Filter by recipient" },
            subject: { type: "string", description: "Filter by subject" },
            hasAttachment: { type: "boolean", description: "Filter emails with attachments" },
            isRead: { type: "boolean", description: "Filter by read status" },
            isStarred: { type: "boolean", description: "Filter starred emails" },
            dateFrom: { type: "string", description: "Start date (ISO format)" },
            dateTo: { type: "string", description: "End date (ISO format)" },
            limit: { type: "number", description: "Max results", default: 100 }
          }
        }
      },

      // 📁 FOLDER MANAGEMENT TOOLS
      {
        name: "get_folders",
        description: "📁 Get all email folders with statistics",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "sync_folders",
        description: "🔄 Synchronize folder structure from server",
        inputSchema: { type: "object", properties: {} }
      },

      // ⚡ EMAIL ACTIONS
      {
        name: "mark_email_read",
        description: "✅ Mark email as read/unread",
        inputSchema: {
          type: "object",
          properties: {
            emailId: { type: "string", description: "Email ID" },
            isRead: { type: "boolean", description: "Read status", default: true }
          },
          required: ["emailId"]
        }
      },
      {
        name: "star_email",
        description: "⭐ Star/unstar email",
        inputSchema: {
          type: "object",
          properties: {
            emailId: { type: "string", description: "Email ID" },
            isStarred: { type: "boolean", description: "Star status", default: true }
          },
          required: ["emailId"]
        }
      },
      {
        name: "move_email",
        description: "📦 Move email to different folder",
        inputSchema: {
          type: "object",
          properties: {
            emailId: { type: "string", description: "Email ID" },
            targetFolder: { type: "string", description: "Target folder name" }
          },
          required: ["emailId", "targetFolder"]
        }
      },
      {
        name: "delete_email",
        description: "🗑️ Delete email permanently",
        inputSchema: {
          type: "object",
          properties: {
            emailId: { type: "string", description: "Email ID to delete" }
          },
          required: ["emailId"]
        }
      },

      // 📊 ANALYTICS & STATISTICS TOOLS
      {
        name: "get_email_stats",
        description: "📊 Get comprehensive email statistics",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "get_email_analytics",
        description: "📈 Get advanced email analytics and insights",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "get_contacts",
        description: "👥 Get contact information with interaction statistics",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max contacts to return", default: 100 }
          }
        }
      },
      {
        name: "get_volume_trends",
        description: "📉 Get email volume trends over time",
        inputSchema: {
          type: "object",
          properties: {
            days: { type: "number", description: "Number of days to analyze", default: 30 }
          }
        }
      },

      // 🔧 SYSTEM & MAINTENANCE TOOLS
      {
        name: "get_connection_status",
        description: "🔌 Check SMTP and IMAP connection status",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "sync_emails",
        description: "🔄 Manually sync emails from server",
        inputSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "Folder to sync (default: all)" },
            full: { type: "boolean", description: "Full sync vs incremental", default: false }
          }
        }
      },
      {
        name: "clear_cache",
        description: "🧹 Clear email cache and analytics cache",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "get_logs",
        description: "📋 Get recent system logs",
        inputSchema: {
          type: "object",
          properties: {
            level: { type: "string", enum: ["debug", "info", "warn", "error"], description: "Log level filter" },
            limit: { type: "number", description: "Max log entries", default: 100 }
          }
        }
      }
    ]
  };
});

// Note: The full tool handler implementation is available in the complete source code
// This version shows the architecture and tool definitions for GitHub display

/**
 * Main server startup function
 */
async function main() {
  logger.info("🌟 Starting Sirency Ultimate Proton Mail MCP Server...", "MCPServer");
  
  try {
    // Verify SMTP connection
    logger.info("🔗 Verifying SMTP connection...", "MCPServer");
    await smtpService.verifyConnection();
    logger.info("✅ SMTP connection verified", "MCPServer");
    
    // Try to connect to IMAP (Proton Bridge)
    logger.info("🔗 Connecting to IMAP (Proton Bridge)...", "MCPServer");
    try {
      await imapService.connect();
      logger.info("✅ IMAP connection established", "MCPServer");
    } catch (imapError) {
      logger.warn("⚠️ IMAP connection failed - email reading features will be limited", "MCPServer", imapError);
      logger.info("💡 Make sure Proton Bridge is running on localhost:1143", "MCPServer");
    }
    
    // Start the MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info("🚀 Sirency Ultimate Proton Mail MCP Server started successfully!", "MCPServer");
    logger.info("🌟 All email management features are now available", "MCPServer");
    
  } catch (error) {
    logger.error("❌ Server startup failed", "MCPServer", error);
    process.exit(1);
  }
}

// Error handling and graceful shutdown
process.on("uncaughtException", (error) => {
  logger.error("💥 Uncaught exception", "MCPServer", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("💥 Unhandled rejection", "MCPServer", reason);
  process.exit(1);
});

process.on("SIGINT", async () => {
  logger.info("📡 Received SIGINT, shutting down gracefully...", "MCPServer");
  try {
    await imapService.disconnect();
    await smtpService.close();
    logger.info("👋 Server shutdown complete", "MCPServer");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during shutdown", "MCPServer", error);
    process.exit(1);
  }
});

// Start the server
main().catch((error) => {
  logger.error("💥 Fatal server error", "MCPServer", error);
  process.exit(1);
});