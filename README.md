# Quick Share Space

Build a Secure Temporary File-Transfer Web App Called "DataTransfer"

Build a modern, responsive web application called DataTransfer.

1. Product Concept

DataTransfer is a temporary, accountless file-transfer platform designed for situations where users need to move files between devices but do not want to log into their personal accounts.

It should work across:

PC → PC

PC → Phone

Phone → PC

Phone → Phone

One device → multiple devices

The main use case is transferring files from a public/shared computer without requiring the user to log into Gmail, Google Drive, WhatsApp, etc.

The second use case is creating a temporary shared room where 2–10 people can exchange files for a limited period.

2. Main Modes

Mode A — Personal Transfer

A user creates a temporary transfer session.

Example:

Room ID: X7K92A
Access PIN: 4816
Expires: 4 hours

The user uploads a file from one device and accesses it from another device using the temporary credentials.

The user should not need to create a permanent account.

Mode B — Temporary Shared Room

A user creates a temporary room and shares the room credentials with other people.

Example:

Room ID: TEAM72
Access PIN: 8391
Expires: 4 hours
Maximum users: 5

Multiple users can join the room and upload/download files.

3. Homepage

Create a clean, professional landing page.

Hero section:

Headline:
"Transfer Files. Temporarily. Securely."

Subheading:
"Move files between phones and computers without logging into your personal accounts."

Primary buttons:

Start Transfer

Create Shared Room

Secondary button:

How It Works

Include a visual showing:

Phone → DataTransfer → Computer

and

Computer → DataTransfer → Multiple Devices

Add a security-focused section explaining:

No permanent account required

Temporary access

Encrypted transfer

Automatic expiration

QR-code joining

Files remain protected after room expiration until deletion is confirmed

4. Create Transfer Page

When the user clicks "Start Transfer", show:

Create Transfer

Fields/options:

Transfer name (optional)

Expiration time:

30 minutes

1 hour

4 hours

12 hours

24 hours

Maximum users:

1

2

5

10

Button:

Create Transfer

After creation, generate:

Room ID

Temporary access PIN

QR code

Shareable temporary link

Example:

Transfer Created

Room ID
X7K92A

Access PIN
4816

Expires in
03:59:42

[ QR CODE ]

[Copy Room ID]
[Copy PIN]
[Copy Link]

[Enter Room]


The room should have a countdown timer.

5. Join Transfer Page

Allow users to join using:

Room ID + PIN

QR code

Temporary share link

UI:

Join Transfer

Room ID
[________]

Access PIN
[________]

[Join Room]

or

[Scan QR Code]


After successful authentication, take the user to the room.

6. Transfer Room

Create a modern file-transfer dashboard.

Top section:

Room: X7K92A
Status: Active
Expires in: 03:21:44
Users: 3/5


Main area:

Upload Files

Large drag-and-drop area:

Drag & Drop Files Here

or

[Choose Files]


Show upload progress.

Each file should display:

File name

File type

File size

Uploaded by

Upload time

Download button

Example:

project.zip
245 MB
Uploaded by Anagh
2 minutes ago

[Download]


7. Multiple User Support

Show connected users.

Example:

Participants

● Anagh — Owner
● Rahul — Participant
● Aryan — Participant


The room owner should be able to:

Remove a participant

Revoke their access

End the room

Change certain room settings if technically possible

Participants should only have the permissions granted to them.

8. File Permissions

When creating a room, allow:

Upload permissions

Everyone

Owner only

Download permissions

Everyone

Owner only

File deletion

Owner only

Anyone

Require everyone to confirm

Default:

Upload: Everyone
Download: Everyone
Delete: Owner / Confirmation


9. Expiration System

The system must distinguish between room expiration and file deletion.

When the timer reaches zero:

ROOM EXPIRED

Access to this room is disabled.

Your files are still securely stored.

Files will be permanently deleted after
[configured retention period]

[Confirm Delete]


Do NOT immediately delete the files merely because the access credentials expired.

The files should remain inaccessible to normal users while waiting for deletion confirmation.

For shared rooms, support:

Deletion Confirmation

Anagh       ✓ Confirmed
Rahul       ✓ Confirmed
Aryan       ✗ Waiting

2/3 users confirmed


Only permanently delete the shared files when the configured deletion condition has been satisfied.

10. QR Code

Every active transfer should generate a QR code containing only the temporary room access information.

Scanning the QR code on a phone should open the join page automatically.

Do not put permanent account credentials inside the QR code.

11. Security Requirements

Security is a major part of the product.

Implement the following where supported by the backend:

Encryption

Use HTTPS/TLS for communication.

Files should be encrypted at rest.

Do not store PINs as plaintext. Store a secure hash where appropriate.

Temporary authentication

Room credentials must expire automatically.

Use secure random tokens for session authentication.

Do not use predictable room IDs or session tokens.

Brute-force protection

Rate-limit PIN attempts.

After multiple failed attempts, temporarily block further attempts.

File validation

Validate:

File size

File extension

MIME type

Prevent dangerous file uploads where possible.

Do not allow uploaded files to execute on the server.

Access isolation

A user must never be able to access another room's files by modifying a URL or ID.

All file access must be authorized server-side.

Session security

Use secure, HttpOnly cookies where appropriate.

Implement CSRF protection where applicable.

Do not expose secret tokens in unnecessary frontend code or logs.

Automatic cleanup

Implement backend cleanup for expired transfers according to the configured retention policy.

12. Important UX Principle

The website should feel extremely simple.

The user should be able to:

Create Room
     ↓
Upload File
     ↓
Show QR / Code
     ↓
Other Device Joins
     ↓
Download File
     ↓
Room Expires
     ↓
Confirm Deletion


Avoid unnecessary registration forms.

Do not force users to create permanent accounts for basic temporary transfers.

13. Dashboard

Create a simple dashboard for an active room.

Include:

Room ID

QR code

PIN

Expiration countdown

Connected users

Uploaded files

Download activity

Upload button

Room settings

Delete/end-room controls

Example activity log:

10:31  Anagh joined
10:32  project.zip uploaded
10:34  Rahul joined
10:35  Rahul downloaded project.zip
10:41  notes.pdf uploaded


14. Responsive Design

The website must work well on:

Desktop

Laptop

Android phones

iPhones

Tablets

On mobile, the interface should be optimized for touch.

The QR scanner/join flow should be particularly simple on phones.

15. Visual Design

Use a modern cybersecurity/cloud-transfer aesthetic.

Style:

Minimal

Professional

Clean

Fast

Trustworthy

Use a dark/light theme toggle.

Use subtle animations but do not make the interface unnecessarily flashy.

Use cards, rounded corners, clear typography, progress indicators and status badges.

Important status colors:

Active

Expiring soon

Expired

Deleted

Uploading

Downloading

Error

16. Technology

Use a modern web stack that Lovable supports.

Prefer:

React

TypeScript

Tailwind CSS

Modern component library

For backend/database/storage, use a secure backend such as Supabase if appropriate.

Use database tables for:

Transfers/rooms

Participants

Files

Sessions/tokens

Activity logs

Deletion confirmations

Use object/file storage for uploaded files.

Do not put uploaded files directly into the database.

17. Data Model

Conceptually create:

Transfers

id
room_id
pin_hash
owner_id/session_id
status
created_at
expires_at
deletion_at
max_users
settings


Participants

id
transfer_id
temporary_user_id
display_name
role
joined_at
last_active
revoked


Files

id
transfer_id
filename
size
mime_type
storage_path
uploaded_by
uploaded_at


Deletion Confirmations

id
transfer_id
participant_id
confirmed
confirmed_at


Activity Logs

id
transfer_id
participant_id
action
timestamp


Do not expose database IDs directly where avoidable.

18. Error Handling

Create clear messages for:

Invalid room ID

Invalid PIN

Room expired

Room full

Access revoked

File too large

Unsupported file

Upload failed

Download failed

Network error

Server error

Example:

This transfer has expired.

The room is no longer accepting connections.


19. Privacy

The application should collect as little personal information as possible.

Do not require:

Name

Email

Phone number

Google account

Social login

unless explicitly needed later.

Users can use temporary display names such as:

User-4821

20. Future Features — Do Not Build Yet

Structure the application so these can be added later:

Permanent accounts

End-to-end encryption

Mobile application

Desktop application

Peer-to-peer transfer

Larger file transfers

Password-protected individual files

File preview

Virus scanning

Transfer history

Cloud backup

Team/workspace accounts

Paid plans

Do not implement unnecessary future features in the first version.

21. MVP Priority

Prioritize these features first:

Create temporary room

Generate secure room ID and PIN

Join room

Upload files

Download files

Multiple users

QR code

Countdown expiration

Access revocation

File deletion confirmation

Responsive mobile interface

Secure backend authorization

Build the MVP so that the architecture can later scale into a production-grade secure file-transfer service.

22. Product Philosophy

The central idea of DataTransfer is:

"Don't log in. Don't carry a USB. Create a temporary secure space, transfer what you need, and leave."

The application should make temporary file transfer between untrusted/public computers and personal devices simple, fast and security-conscious.

Build the application as a functional MVP, not merely a static UI mockup. All core buttons, room creation, joining, file upload/download, expiration, participant management and deletion flows should work with the chosen backend.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://transient-files.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/10f2d22f-87c6-4e74-8ed8-6c10eaedf3a5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
