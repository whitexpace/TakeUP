# QA Smoke Checklist

## Accounts and Auth

- Verify authenticated users can reach protected account pages and unauthenticated users are redirected.
- Verify auth callback completes without leaving the user in a broken session state.
- Verify logout clears access to protected pages.

## Browse and Discovery

- Verify landing, dashboard, and feed pages load without runtime errors.
- Verify item search, filters, and sort controls change the visible results as expected.
- Verify item detail pages load images, pricing, and lender metadata correctly.
- Verify likes and bag/cart flows update counts and page content correctly.

## Listings and Analytics

- Verify lender listing creation, edit, and status toggle flows succeed.
- Verify the analytics dashboard loads summary cards, ranked sections, and detail pages.
- Verify analytics range switching updates data.
- Verify analytics empty, no-activity, and retry/error states render correctly.

## Requests, Bookings, Transactions, and Chat

- Verify borrowers can create, edit, and delete item requests.
- Verify lenders can submit, update, and delete request offers.
- Verify borrower and lender booking/transaction pages load and status actions behave correctly.
- Verify chat conversations open, send messages, update unread counts, and mark messages as read.

## Reviews, Notifications, and Account Actions

- Verify header and account notifications can be read individually and in bulk.
- Verify review draft, submit, and display flows work for completed transactions.
- Verify account profile updates, deactivation checks, deletion checks, wallet, and rewards pages load and behave correctly.
