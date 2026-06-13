-- Send an iMessage via Messages.app.
-- Usage: osascript send.applescript "+15551234567" "your message"
--
-- Note: the exact syntax is macOS-version-sensitive. This `service`+`buddy`
-- form works on most recent versions. If your macOS errors, try replacing
-- `buddy targetPhone` with `participant targetPhone`, or `service` with
-- `account`.
on run argv
    set targetPhone to item 1 of argv
    set targetMessage to item 2 of argv
    tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy targetPhone of targetService
        send targetMessage to targetBuddy
    end tell
end run
