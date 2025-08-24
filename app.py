
import os
import datetime as dt
from typing import List, Dict, Any

import streamlit as st
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/calendar"]

def get_credentials():
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                creds = None
        if not creds:
            if not os.path.exists("credentials.json"):
                st.error("Missing credentials.json. See README for setup steps.")
                st.stop()
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    return creds

def get_service(creds):
    return build("calendar", "v3", credentials=creds)

def iso(dtobj: dt.datetime) -> str:
    if dtobj.tzinfo is None:
        dtobj = dtobj.replace(tzinfo=dt.timezone.utc)
    return dtobj.isoformat()

def list_events(service, calendar_id: str, time_min: str, time_max: str, q: str = "", max_results: int = 50) -> List[Dict[str, Any]]:
    return service.events().list(calendarId=calendar_id, timeMin=time_min, timeMax=time_max,
                                 maxResults=max_results, singleEvents=True, orderBy="startTime", q=q).execute().get("items", [])

def check_conflict(service, calendar_id: str, start_iso: str, end_iso: str) -> bool:
    evs = service.events().list(calendarId=calendar_id, timeMin=start_iso, timeMax=end_iso, singleEvents=True).execute().get("items", [])
    return len(evs) > 0

def patch_event_time(service, calendar_id: str, event_id: str, new_start: dt.datetime, new_end: dt.datetime, tz: str):
    body = {"start": {"dateTime": new_start.isoformat(), "timeZone": tz},
            "end": {"dateTime": new_end.isoformat(), "timeZone": tz}}
    return service.events().patch(calendarId=calendar_id, eventId=event_id, body=body).execute()

st.set_page_config(page_title="Calendar Rescheduler", page_icon="🗓️", layout="centered")
st.title("🗓️ Google Calendar Rescheduler")
st.caption("Select an event, pick a new time, and reschedule.")

with st.sidebar:
    st.header("Settings")
    calendar_id = st.text_input("Calendar ID", os.getenv("GCAL_CAL_ID", "primary"))
    tz = st.text_input("Time zone (IANA)", os.getenv("GCAL_TZ", "Europe/London"))
    search_q = st.text_input("Filter by title (optional)", "")
    days_ahead = st.slider("Look ahead (days)", 1, 60, 14)
    min_notice_hours = st.slider("Minimum notice (hours)", 0, 72, 24)
    business_hours = st.slider("Business hours", 0, 23, (9, 17))

try:
    creds = get_credentials()
    service = get_service(creds)
except Exception as e:
    st.error(f"Auth error: {e}")
    st.stop()

now = dt.datetime.now(dt.timezone.utc)
time_min = iso(now)
time_max = iso(now + dt.timedelta(days=days_ahead))

with st.spinner("Loading events..."):
    try:
        events = list_events(service, calendar_id, time_min, time_max, q=search_q, max_results=100)
    except HttpError as e:
        st.error(f"API error: {e}")
        st.stop()

if not events:
    st.info("No upcoming events in range. Try increasing the window or check your calendar ID.")
    st.stop()

def fmt_event(e):
    s = e["start"].get("dateTime") or e["start"].get("date")
    en = e["end"].get("dateTime") or e["end"].get("date")
    return f"{e.get('summary','(no title)')} — {s} → {en}"

idx = st.selectbox("Select an event", options=list(range(len(events))), format_func=lambda i: fmt_event(events[i]))
ev = events[idx]

def parse_iso(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z","+00:00")) if "Z" in s else dt.datetime.fromisoformat(s)

cur_start = parse_iso(ev["start"].get("dateTime") or ev["start"].get("date"))
cur_end = parse_iso(ev["end"].get("dateTime") or ev["end"].get("date"))
duration = cur_end - cur_start

st.markdown(f"**Current:** {cur_start.isoformat()} → {cur_end.isoformat()} ({int(duration.total_seconds()/60)} mins)")

st.markdown("### New time")
c1, c2 = st.columns(2)
with c1:
    new_date = st.date_input("Date", value=(cur_start + dt.timedelta(days=2)).date())
with c2:
    new_time = st.time_input("Start", value=dt.time(hour=max(business_hours[0], cur_start.hour), minute=0))

keep_duration = st.checkbox("Keep duration", value=True)
if keep_duration:
    new_end_time = (dt.datetime.combine(dt.date(2000,1,1), new_time) + duration).time()
else:
    new_end_time = st.time_input("End", value=dt.time(hour=min(business_hours[1], 23), minute=0))

new_start = dt.datetime.combine(new_date, new_time, tzinfo=dt.timezone.utc)
new_end = dt.datetime.combine(new_date, new_end_time, tzinfo=dt.timezone.utc)

violations = []
if (new_start - now) < dt.timedelta(hours=min_notice_hours):
    violations.append(f"Minimum notice ({min_notice_hours}h) not met.")
if not (business_hours[0] <= new_start.hour < business_hours[1]):
    violations.append(f"Start time outside business hours ({business_hours[0]}–{business_hours[1]}).")

conflicts = False
try:
    conflicts = check_conflict(service, calendar_id, new_start.isoformat(), new_end.isoformat())
except HttpError as e:
    st.warning(f"Conflict check failed: {e}")

if violations: st.warning(" • ".join(violations))
if conflicts: st.warning("There is a conflicting event in that window.")

if st.button("Reschedule event", type="primary", disabled=bool(violations)):
    try:
        updated = patch_event_time(service, calendar_id, ev["id"], new_start, new_end, tz)
        link = updated.get("htmlLink", "")
        st.success("Event rescheduled ✅")
        if link: st.markdown(f"[Open in Google Calendar]({link})")
    except HttpError as e:
        st.error(f"Update failed: {e}")
