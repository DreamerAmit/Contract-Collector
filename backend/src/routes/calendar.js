const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { authenticate } = require('../middleware/auth');
const { CalendarEvent, Contract } = require('../models');

// Get calendar events for the current user
router.get('/', authenticate, async (req, res) => {
  try {
    const events = await CalendarEvent.findAll({
      include: [{
        model: Contract,
        where: { userId: req.user.id },
        attributes: ['id', 'name']
      }],
      order: [['startDate', 'ASC']]
    });
    
    res.json(events);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to get calendar events', details: error.message }
    });
  }
});

// Create a new calendar event
router.post('/', authenticate, async (req, res) => {
  try {
    const { contractId, title, description, startDate, endDate, location } = req.body;
    
    // Validate input
    if (!contractId || !title || !startDate) {
      return res.status(400).json({
        error: { message: 'Contract ID, title, and start date are required' }
      });
    }
    
    // Check if contract exists and belongs to user
    const contract = await Contract.findOne({
      where: {
        id: contractId,
        userId: req.user.id
      }
    });
    
    if (!contract) {
      return res.status(404).json({
        error: { message: 'Contract not found' }
      });
    }
    
    // Create event
    const event = await CalendarEvent.create({
      contractId,
      title,
      description,
      startDate,
      endDate,
      location
    });
    
    // If user has Google connected, create Google Calendar event
    if (req.user.googleRefreshToken) {
      try {
        const googleEventId = await createGoogleCalendarEvent(
          req.user.googleRefreshToken,
          title,
          description,
          startDate,
          endDate,
          location
        );
        
        // Save Google event ID
        if (googleEventId) {
          event.googleEventId = googleEventId;
          await event.save();
        }
      } catch (googleError) {
        console.error('Failed to create Google Calendar event:', googleError);
        // Continue without Google Calendar integration
      }
    }
    
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to create calendar event', details: error.message }
    });
  }
});

// Update a calendar event
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, location } = req.body;
    
    // Find event and check ownership
    const event = await CalendarEvent.findOne({
      include: [{
        model: Contract,
        where: { userId: req.user.id }
      }],
      where: { id }
    });
    
    if (!event) {
      return res.status(404).json({
        error: { message: 'Calendar event not found' }
      });
    }
    
    // Update fields
    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (startDate) event.startDate = startDate;
    if (endDate !== undefined) event.endDate = endDate;
    if (location !== undefined) event.location = location;
    
    await event.save();
    
    // Update Google Calendar event if connected
    if (req.user.googleRefreshToken && event.googleEventId) {
      try {
        await updateGoogleCalendarEvent(
          req.user.googleRefreshToken,
          event.googleEventId,
          title,
          description,
          startDate,
          endDate,
          location
        );
      } catch (googleError) {
        console.error('Failed to update Google Calendar event:', googleError);
        // Continue without Google Calendar integration
      }
    }
    
    res.json(event);
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to update calendar event', details: error.message }
    });
  }
});

// Delete a calendar event
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find event and check ownership
    const event = await CalendarEvent.findOne({
      include: [{
        model: Contract,
        where: { userId: req.user.id }
      }],
      where: { id }
    });
    
    if (!event) {
      return res.status(404).json({
        error: { message: 'Calendar event not found' }
      });
    }
    
    // Delete Google Calendar event if connected
    if (req.user.googleRefreshToken && event.googleEventId) {
      try {
        await deleteGoogleCalendarEvent(
          req.user.googleRefreshToken,
          event.googleEventId
        );
      } catch (googleError) {
        console.error('Failed to delete Google Calendar event:', googleError);
        // Continue without Google Calendar integration
      }
    }
    
    // Delete event
    await event.destroy();
    
    res.json({ message: 'Calendar event deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: { message: 'Failed to delete calendar event', details: error.message }
    });
  }
});

// Helper functions for Google Calendar integration
async function createGoogleCalendarEvent(refreshToken, title, description, startDate, endDate, location) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  const event = {
    summary: title,
    description: description || '',
    location: location || '',
    start: {
      dateTime: new Date(startDate).toISOString(),
      timeZone: 'UTC'
    },
    end: {
      dateTime: new Date(endDate || startDate).toISOString(),
      timeZone: 'UTC'
    }
  };
  
  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event
  });
  
  return response.data.id;
}

async function updateGoogleCalendarEvent(refreshToken, eventId, title, description, startDate, endDate, location) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  // First get the existing event
  const existingEvent = await calendar.events.get({
    calendarId: 'primary',
    eventId: eventId
  });
  
  // Update only provided fields
  const updatedEvent = { ...existingEvent.data };
  
  if (title) updatedEvent.summary = title;
  if (description !== undefined) updatedEvent.description = description;
  if (location !== undefined) updatedEvent.location = location;
  if (startDate) updatedEvent.start = {
    dateTime: new Date(startDate).toISOString(),
    timeZone: 'UTC'
  };
  if (endDate !== undefined) updatedEvent.end = {
    dateTime: new Date(endDate || startDate).toISOString(),
    timeZone: 'UTC'
  };
  
  // Update event
  await calendar.events.update({
    calendarId: 'primary',
    eventId: eventId,
    resource: updatedEvent
  });
}

async function deleteGoogleCalendarEvent(refreshToken, eventId) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId
  });
}

module.exports = router; 