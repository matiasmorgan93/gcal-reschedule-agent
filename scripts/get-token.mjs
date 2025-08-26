#!/usr/bin/env node

import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

async function getAccessToken() {
  try {
    // Load OAuth2 credentials
    const credentials = JSON.parse(readFileSync('oauth-credentials.json', 'utf8'));
    
    const oauth2Client = new google.auth.OAuth2(
      credentials.installed.client_id,
      credentials.installed.client_secret,
      credentials.installed.redirect_uris[0]
    );

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('🔗 Authorize this app by visiting this url:');
    console.log(authUrl);
    console.log('\n📋 After authorization, paste the code here:');

    // Get authorization code from user
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const code = await new Promise((resolve) => {
      rl.question('Authorization code: ', resolve);
    });
    rl.close();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens
    writeFileSync('token.json', JSON.stringify(tokens, null, 2));
    
    console.log('✅ Access token saved to token.json');
    console.log('🔑 You can now run: MODE=live npm run eval:micro');
    
  } catch (error) {
    console.error('❌ Error getting access token:', error.message);
    console.log('\n📝 Make sure you have:');
    console.log('1. oauth-credentials.json file in project root');
    console.log('2. Google Calendar API enabled in your project');
    process.exit(1);
  }
}

getAccessToken();
