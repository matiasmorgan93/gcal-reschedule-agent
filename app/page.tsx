"use client"

import { useState, useEffect } from "react"
import { Calendar, Clock, Settings, CheckCircle, Sparkles, ArrowRight, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { GuardrailPanel, Violation } from "@/components/GuardrailPanel"

interface Event {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

export default function CalendarRescheduler() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState("")
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [keepDuration, setKeepDuration] = useState(true)
  const [isRescheduled, setIsRescheduled] = useState(false)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventData, setSelectedEventData] = useState<Event | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [userTimeZone, setUserTimeZone] = useState<string>('')

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus()
    setUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status')
      const data = await response.json()
      setIsAuthenticated(data.authenticated)
      if (data.authenticated) {
        await loadEvents()
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const response = await fetch('/api/events')
      const data = await response.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Failed to load events:', error)
      setEvents([])
    }
  }

  const handleSignIn = async () => {
    try {
      window.location.href = '/api/auth/google'
    } catch (error) {
      console.error('Sign in failed:', error)
    }
  }

  const validateProposedTime = async () => {
    if (!selectedEventData || !newDate || !newTime) return

    setIsValidating(true)
    try {
      const response = await fetch('/api/validate-reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: selectedEventData.id,
          newDate,
          newTime,
          keepDuration,
          userTimeZone,
        }),
      })

      const data = await response.json()
      setViolations(data.violations || [])
    } catch (error) {
      console.error('Validation failed:', error)
      setViolations([])
    } finally {
      setIsValidating(false)
    }
  }

  const handleReschedule = async () => {
    if (!selectedEventData || !newDate || !newTime) return

    setIsRescheduling(true)
    try {
      // Calculate new start and end times
      const newStart = new Date(`${newDate}T${newTime}:00`);
      const currentStart = new Date(selectedEventData.start.dateTime || selectedEventData.start.date!);
      const currentEnd = new Date(selectedEventData.end.dateTime || selectedEventData.end.date!);
      const duration = currentEnd.getTime() - currentStart.getTime();
      const newEnd = keepDuration 
        ? new Date(newStart.getTime() + duration)
        : new Date(`${newDate}T${newTime}:00`);

      const response = await fetch('/api/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: selectedEventData.id,
          newStartISO: newStart.toISOString(),
          newEndISO: newEnd.toISOString(),
          timeZone: userTimeZone,
        }),
      })

      if (response.ok) {
        setIsRescheduled(true)
        await loadEvents() // Refresh events
      } else {
        const data = await response.json()
        if (data.error) {
          // Show policy error message
          setViolations([{ code: data.error, message: data.error }])
        } else {
          throw new Error('Failed to reschedule')
        }
      }
    } catch (error) {
      console.error('Reschedule failed:', error)
    } finally {
      setIsRescheduling(false)
    }
  }

  const resetForm = () => {
    setIsRescheduled(false)
    setSelectedEvent("")
    setNewDate("")
    setNewTime("")
    setKeepDuration(true)
    setSelectedEventData(null)
    setViolations([])
  }

  const handleEventSelect = (eventId: string) => {
    setSelectedEvent(eventId)
    const event = events.find(e => e.id === eventId)
    setSelectedEventData(event || null)
    
    if (event) {
      const startDate = event.start.dateTime || event.start.date
      if (startDate) {
        const start = new Date(startDate)
        setNewDate(start.toISOString().split('T')[0])
        setNewTime(start.toTimeString().slice(0, 5))
      }
    }
  }

  const formatEventTime = (event: Event) => {
    const start = event.start.dateTime || event.start.date
    const end = event.end.dateTime || event.end.date
    
    if (!start || !end) {
      return event.summary || 'Unknown Event'
    }
    
    const startDate = new Date(start)
    const endDate = new Date(end)
    const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
    
    return `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${duration} mins)`
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Sign-in page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="mb-6 relative">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-primary" />
              </div>
              <Sparkles className="w-6 h-6 text-accent absolute top-0 right-1/3 animate-ping" />
              <Sparkles className="w-4 h-4 text-primary absolute bottom-2 left-1/4 animate-ping delay-300" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Calendar Rescheduler</h2>
            <p className="text-muted-foreground mb-6">
              Connect your Google Calendar to start rescheduling events with AI assistance
            </p>

            <Button onClick={handleSignIn} className="w-full h-12 text-base font-medium">
              <Mail className="w-5 h-5 mr-2" />
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success page
  if (isRescheduled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="mb-6 relative">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <CheckCircle className="w-10 h-10 text-primary animate-bounce" />
              </div>
              <Sparkles className="w-6 h-6 text-accent absolute top-0 right-1/3 animate-ping" />
              <Sparkles className="w-4 h-4 text-primary absolute bottom-2 left-1/4 animate-ping delay-300" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">Event Rescheduled!</h2>
            <p className="text-muted-foreground mb-6">
              Your meeting has been successfully moved to{" "}
              <span className="font-semibold text-foreground">{newDate}</span> at{" "}
              <span className="font-semibold text-foreground">{newTime}</span>
            </p>

            <div className="space-y-3 mb-6">
              <Badge variant="secondary" className="px-4 py-2">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar Updated
              </Badge>
              <Badge variant="secondary" className="px-4 py-2">
                <Clock className="w-4 h-4 mr-2" />
                Attendees Notified
              </Badge>
            </div>

            <div className="flex gap-3">
              <Button onClick={resetForm} variant="outline" className="flex-1 bg-transparent">
                Reschedule Another
              </Button>
              <Button onClick={() => window.open("https://calendar.google.com", "_blank")} className="flex-1">
                Open Calendar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main rescheduler interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="relative mb-8">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mr-3">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-foreground">Calendar Rescheduler</h1>
              </div>
              <p className="text-muted-foreground text-lg">
                Effortlessly reschedule your Google Calendar events with AI assistance
              </p>
            </div>
            
            {/* Sign Out Button - Top Right */}
            <div className="absolute top-0 right-0">
              <Button 
                onClick={() => window.location.href = '/api/auth/logout'} 
                variant="outline" 
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                Sign Out
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Settings Sidebar */}
            <Card className="lg:col-span-1 shadow-lg border-0 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                  <Settings className="w-5 h-5 mr-2 text-primary" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Calendar ID</Label>
                  <Input value="primary" disabled className="mt-1 bg-muted/50" />
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Time Zone</Label>
                  <Select defaultValue="europe-london">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="europe-london">Europe/London</SelectItem>
                      <SelectItem value="america-new-york">America/New_York</SelectItem>
                      <SelectItem value="asia-tokyo">Asia/Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Look Ahead (days)</Label>
                  <Input type="number" defaultValue="14" className="mt-1" />
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Minimum Notice (hours)</Label>
                  <Input type="number" defaultValue="24" className="mt-1" />
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Business Hours</Label>
                  <div className="flex gap-2 mt-1">
                    <Input defaultValue="09:00" className="flex-1" />
                    <Input defaultValue="17:00" className="flex-1" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Rescheduling Form */}
            <Card className="lg:col-span-2 shadow-lg border-0 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">Reschedule Event</CardTitle>
                <p className="text-muted-foreground">Select an event, pick a new time, and reschedule.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="event-select" className="text-sm font-medium">
                    Select an event
                  </Label>
                  <Select value={selectedEvent} onValueChange={handleEventSelect}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose an event to reschedule" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.summary} — {formatEventTime(event)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEventData && (
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-1">Current:</p>
                    <p className="font-medium">{formatEventTime(selectedEventData)}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new-date" className="text-sm font-medium">
                      New Date
                    </Label>
                    <Input
                      id="new-date"
                      type="date"
                      value={newDate}
                      onChange={(e) => {
                        setNewDate(e.target.value)
                        setViolations([]) // Clear violations when user changes input
                      }}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-time" className="text-sm font-medium">
                      Start Time
                    </Label>
                    <Input
                      id="new-time"
                      type="time"
                      value={newTime}
                      onChange={(e) => {
                        setNewTime(e.target.value)
                        setViolations([]) // Clear violations when user changes input
                      }}
                      className="mt-2"
                    />
                  </div>
                </div>

                {/* Guardrail Validation Panel */}
                {(selectedEventData && newDate && newTime) && (
                  <GuardrailPanel 
                    violations={violations} 
                    isLoading={isValidating}
                  />
                )}

                {/* Validate Button */}
                {(selectedEventData && newDate && newTime) && (
                  <Button
                    onClick={validateProposedTime}
                    disabled={isValidating}
                    variant="outline"
                    className="w-full"
                  >
                    {isValidating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Validate Proposed Time
                      </>
                    )}
                  </Button>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="keep-duration" 
                    checked={keepDuration} 
                    onCheckedChange={(checked) => setKeepDuration(checked === true)} 
                  />
                  <Label htmlFor="keep-duration" className="text-sm">
                    Keep duration
                  </Label>
                </div>

                <Button
                  onClick={handleReschedule}
                  disabled={!selectedEvent || !newDate || !newTime || isRescheduling || violations.length > 0}
                  className="w-full h-12 text-base font-medium"
                >
                  {isRescheduling ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Rescheduling...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-5 h-5 mr-2" />
                      Reschedule Event
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
