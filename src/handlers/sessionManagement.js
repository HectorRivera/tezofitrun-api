// src/handlers/sessionManagement.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// POST /session/create
exports.createSession = async (event) => {
  console.log("=== CREATE SESSION ===");

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      createdBy,
      createdByRole,
      athleteId,
      coachId,
      title,
      description,
      terrain,
      estimatedDuration,
      scheduledDate, // optional - null for immediate start
    } = body;

    console.log("Creating session:", {
      createdBy,
      createdByRole,
      athleteId,
      coachId,
      title,
    });

    // Insert new session
    const sessionResult = await pool.query(
      `
      INSERT INTO sessions (
        created_by, created_by_role, athlete_id, coach_id, 
        title, description, terrain, estimated_duration, 
        scheduled_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, status, created_at
    `,
      [
        createdBy,
        createdByRole,
        athleteId,
        coachId,
        title,
        description,
        terrain,
        estimatedDuration,
        scheduledDate,
        scheduledDate ? "scheduled" : "draft",
      ]
    );

    const session = sessionResult.rows[0];

    // Record state change
    await pool.query(
      `
      INSERT INTO session_state_changes (session_id, from_status, to_status, changed_by, reason)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [session.id, null, session.status, createdBy, "Session created"]
    );

    console.log("Session created:", session.id);

    return {
      statusCode: 201,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        sessionId: session.id,
        status: session.status,
        createdAt: session.created_at,
      }),
    };
  } catch (error) {
    console.error("Error creating session:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

// GET /session/available/{userId}
exports.getAvailableSessions = async (event) => {
  console.log("=== GET AVAILABLE SESSIONS ===");

  try {
    const userId = event.pathParameters?.userId;
    console.log("Getting sessions for user:", userId);

    // Get sessions where user is athlete or coach, and session is not completed/cancelled/abandoned
    const result = await pool.query(
      `
      SELECT 
        id, created_by, created_by_role, athlete_id, coach_id,
        title, description, terrain, estimated_duration,
        status, scheduled_date, actual_start_time,
        created_at
      FROM sessions 
      WHERE (athlete_id = $1 OR coach_id = $1)
        AND status IN ('draft', 'scheduled', 'active', 'paused')
      ORDER BY 
        CASE status 
          WHEN 'active' THEN 1 
          WHEN 'scheduled' THEN 2 
          WHEN 'draft' THEN 3 
          WHEN 'paused' THEN 4 
        END,
        scheduled_date ASC NULLS LAST,
        created_at DESC
    `,
      [userId]
    );

    console.log(`Found ${result.rows.length} available sessions`);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        sessions: result.rows,
      }),
    };
  } catch (error) {
    console.error("Error getting available sessions:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

// POST /session/{sessionId}/start
exports.startSession = async (event) => {
  console.log("=== START SESSION ===");

  try {
    const sessionId = event.pathParameters?.sessionId;
    const body = JSON.parse(event.body || "{}");
    const { userId } = body;

    console.log("Starting session:", sessionId, "by user:", userId);

    // Check if session exists and user has permission
    const sessionCheck = await pool.query(
      `
      SELECT status, athlete_id, coach_id, scheduled_date
      FROM sessions 
      WHERE id = $1 AND (athlete_id = $2 OR coach_id = $2)
    `,
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: false,
          error: "Session not found or no permission",
        }),
      };
    }

    const session = sessionCheck.rows[0];
    const currentTime = new Date();

    // Handle immediate start (draft → scheduled → active)
    if (session.status === "draft") {
      // First transition to scheduled
      await pool.query(
        `
        UPDATE sessions 
        SET status = 'scheduled', scheduled_date = $1, updated_at = $1
        WHERE id = $2
      `,
        [currentTime, sessionId]
      );

      await pool.query(
        `
        INSERT INTO session_state_changes (session_id, from_status, to_status, changed_by, reason)
        VALUES ($1, 'draft', 'scheduled', $2, 'Immediate start - auto-scheduled')
      `,
        [sessionId, userId]
      );
    }

    // Transition to active
    await pool.query(
      `
      UPDATE sessions 
      SET status = 'active', actual_start_time = $1, updated_at = $1
      WHERE id = $2
    `,
      [currentTime, sessionId]
    );

    await pool.query(
      `
      INSERT INTO session_state_changes (session_id, from_status, to_status, changed_by, reason)
      VALUES ($1, $2, 'active', $3, 'Session started by user')
    `,
      [
        sessionId,
        session.status === "draft" ? "scheduled" : session.status,
        userId,
      ]
    );

    console.log("Session started successfully:", sessionId);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        sessionId,
        status: "active",
        startTime: currentTime,
      }),
    };
  } catch (error) {
    console.error("Error starting session:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

// POST /session/{sessionId}/end
exports.endSession = async (event) => {
  console.log("=== END SESSION ===");

  try {
    const sessionId = event.pathParameters?.sessionId;
    const body = JSON.parse(event.body || "{}");
    const { userId, reason } = body; // reason: 'completed', 'stopped_early', 'cancelled'

    console.log(
      "Ending session:",
      sessionId,
      "by user:",
      userId,
      "reason:",
      reason
    );

    // Check if session exists and user has permission
    console.log("🔍 Checking session permissions...");
    const sessionCheck = await pool.query(
      `
      SELECT status, athlete_id, coach_id, actual_start_time
      FROM sessions 
      WHERE id = $1 AND (athlete_id = $2 OR coach_id = $2)
    `,
      [sessionId, userId]
    );
    console.log("🔍 Session check result:", sessionCheck.rows);
    if (sessionCheck.rows.length === 0) {
      console.log("❌ Session not found or no permission");
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: false,
          error: "Session not found or no permission",
        }),
      };
    }

    const session = sessionCheck.rows[0];
    const currentTime = new Date();

    // Determine final status based on reason
    let finalStatus = reason === "completed" ? "completed" : "abandoned";
    console.log("🔄 Updating session status to:", finalStatus);
    //let finalStatus;
    switch (reason) {
      case "completed":
        finalStatus = "completed";
        break;
      case "stopped_early":
        finalStatus = "abandoned";
        break;
      case "cancelled":
        finalStatus = "cancelled";
        break;
      default:
        finalStatus = "completed";
    }
    //console.log("✅ Session update result:", updateResult);
    // Update session
    await pool.query(
      `
      UPDATE sessions 
      SET status = $1, actual_end_time = $2, updated_at = $2
      WHERE id = $3
    `,
      [finalStatus, currentTime, sessionId]
    );

    // Record state change
    await pool.query(
      `
      INSERT INTO session_state_changes (session_id, from_status, to_status, changed_by, reason)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [
        sessionId,
        session.status,
        finalStatus,
        userId,
        `Session ended: ${reason}`,
      ]
    );

    console.log(
      "Session ended successfully:",
      sessionId,
      "Status:",
      finalStatus
    );

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        sessionId,
        status: finalStatus,
        endTime: currentTime,
      }),
    };
  } catch (error) {
    console.error("Error ending session:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

// src/handlers/sessionManagement.js - add this function
// GET /session/restore/{userId}
exports.restoreActiveSession = async (event) => {
  console.log("=== RESTORE ACTIVE SESSION ===");

  try {
    const userId = event.pathParameters?.userId;

    // Find any active session for this user
    const result = await pool.query(
      `
      SELECT * FROM sessions 
      WHERE (athlete_id = $1 OR coach_id = $1) 
        AND status = 'active'
      ORDER BY actual_start_time DESC
      LIMIT 1
    `,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: false,
          message: "No active session found",
        }),
      };
    }

    const session = result.rows[0];
    console.log("Restored active session:", session.id);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        session: session,
      }),
    };
  } catch (error) {
    console.error("Error restoring session:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
