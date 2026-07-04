import { FollowUp } from "@/integrations/firebase/complaintsAPI";
import { formatInTimeZone } from "date-fns-tz";
import { MessageSquare } from "lucide-react";

interface FollowUpsPanelProps {
  followUps?: FollowUp[];
}

const PAKISTAN_TIMEZONE = "Asia/Karachi";

const formatTimestamp = (timestamp: string): string => {
  return formatInTimeZone(new Date(timestamp), PAKISTAN_TIMEZONE, "MMM dd, yyyy HH:mm");
};

export default function FollowUpsPanel({ followUps }: FollowUpsPanelProps) {
  if (!followUps || followUps.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <MessageSquare className="h-5 w-5 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">No follow-ups yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {followUps.map((followUp, index) => (
        <div key={index} className="p-4 border border-gray-200 rounded-lg bg-white">
          {followUp.subject && (
            <p className="text-sm font-semibold text-gray-900 mb-2">
              {followUp.subject}
            </p>
          )}
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mb-3">
            {followUp.description}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              <span className="font-semibold text-gray-600">
                {followUp.addedByName || followUp.addedBy || "Unknown"}
              </span>
            </span>
            <span>{formatTimestamp(followUp.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
