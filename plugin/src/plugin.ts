import streamDeck, { LogLevel } from '@elgato/streamdeck';
import { SessionAction } from './actions/session.js';

// Set log level for debugging
streamDeck.logger.setLevel(LogLevel.DEBUG);

// Register the session action
streamDeck.actions.registerAction(new SessionAction());

// Connect to Stream Deck
streamDeck.connect();
