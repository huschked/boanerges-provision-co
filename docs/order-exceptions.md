# Operational order exceptions

WEB-013 treats an exception as a view of an order's current operational state. It does not maintain a second manually dismissed exception record. Correcting the underlying order field therefore removes the exception on the next admin refresh.

| Exception | Severity | Detection | Resolution |
| --- | --- | --- | --- |
| Overdue fulfillment | High | Paid order remains `pending` more than 48 hours after payment | Pack or cancel the order |
| Inventory conflict | Critical | Inventory/reservation error or conflict marker | Reconcile stock, then successfully pack the order |
| Invalid address | High | Shippo destination validation writes `shippingAddressException` | Successfully validate the corrected destination |
| Payment dispute | Critical | Stripe dispute is present and not closed, won, or lost | Resolve the dispute in Stripe |
| Email failure | Medium | Any order, shipment, delivery, delay, or exception notification is `failed` | Retry the notification successfully |
| Label failure | High | A Shippo label purchase exception requires review | Verify Shippo and successfully purchase/reconcile the label |
| Tracking gap | High | Fulfillment is `shipped` without a tracking number | Add tracking or purchase a valid label |
| Carrier exception | High/Critical | Shipment is delayed, exception, failure, or returned | A later normal carrier webhook or delivery clears the exception |
| Refund request | High | Refund request status is requested, pending, or requires review | Issue the refund or update the request to a resolved state |

The Orders queue sorts exception views by severity and then oldest exception first. “All” preserves the existing recent-order ordering. The dashboard total and per-category counts navigate directly to their matching queues.

The 48-hour handling deadline is currently a shared classifier default. If the business handling promise changes, update the default in `src/lib/orderExceptions.ts` and the customer-facing handling copy together.
