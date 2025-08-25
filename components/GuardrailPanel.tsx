"use client"

import { CheckCircle, XCircle, Clock, Building, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface Violation {
  code: 'BUSINESS_HOURS_OUTSIDE' | 'NOTICE_TOO_SOON' | 'TIME_CONFLICT';
  message: string;
  details?: Record<string, unknown>;
}

interface GuardrailPanelProps {
  violations: Violation[];
  isLoading?: boolean;
}

const guardrailConfig = {
  BUSINESS_HOURS_OUTSIDE: {
    title: 'Business Hours',
    icon: Building,
    description: 'Event must be within configured business hours',
  },
  NOTICE_TOO_SOON: {
    title: 'Notice Period',
    icon: Clock,
    description: 'Event must be scheduled with sufficient advance notice',
  },
  TIME_CONFLICT: {
    title: 'No Conflicts',
    icon: AlertTriangle,
    description: 'Event must not conflict with existing calendar events',
  },
}

export function GuardrailPanel({ violations, isLoading = false }: GuardrailPanelProps) {
  const allGuardrails = Object.entries(guardrailConfig).map(([code, config]) => ({
    code: code as Violation['code'],
    ...config,
  }))

  if (isLoading) {
    return (
      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
            Validating...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allGuardrails.map((guardrail) => (
              <div key={guardrail.code} className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-muted rounded animate-pulse" />
                <span className="text-sm text-muted-foreground">{guardrail.title}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasViolations = violations.length > 0

  return (
    <Card className={`shadow-lg border-0 bg-card/80 backdrop-blur-sm ${hasViolations ? 'border-red-200' : 'border-green-200'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          {hasViolations ? (
            <XCircle className="w-5 h-5 text-red-500 mr-2" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
          )}
          Guardrail Validation
          <Badge 
            variant={hasViolations ? "destructive" : "default"} 
            className="ml-2"
          >
            {hasViolations ? `${violations.length} Issue${violations.length > 1 ? 's' : ''}` : 'All Clear'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allGuardrails.map((guardrail) => {
            const violation = violations.find(v => v.code === guardrail.code)
            const Icon = guardrail.icon
            
            return (
              <div key={guardrail.code} className="flex items-start space-x-3">
                {violation ? (
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{guardrail.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {guardrail.description}
                  </p>
                  {violation && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {violation.message}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        {hasViolations && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">
              Reschedule blocked due to policy violations. Please adjust your proposed time.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
