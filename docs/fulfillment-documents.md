# Fulfillment documents

WEB-017 adds printable operational documents to the admin Orders workspace.

## Packing slip

Select an order and choose **Packing Slip**. The letter-size internal fulfillment copy includes the order reference and date, customer contact, validated shipping address, product ID, product name, size, quantity to pack, internal packing instructions, and completion checkboxes.

Canceled quantities are subtracted and fully canceled lines are omitted. The QR code contains the exact production-origin admin URL and order id. Scanning it opens the secure admin sign-in and, after authentication, filters the Orders workspace to that order.

Because admin notes can contain internal information, review the instructions section before placing a printed copy inside a customer package.

## Consolidated pick list

Use the checkbox beside each eligible order or choose **Select fulfillable**, then choose **Print Pick List**. Eligibility is limited to paid or partially refunded orders whose fulfillment state is `pending` or `packed` and which still have quantities to fulfill.

The pick list groups repeated lines and multiple orders by product ID and size. It shows total units and the number of included orders, followed by the included order references. Product IDs currently act as internal SKUs.

## Print verification

Before moving WEB-017 to Done, use browser print preview to confirm:

1. Letter paper, portrait orientation, default scale, and 0.5-inch margins fit without clipping.
2. Long customer names, addresses, product names, and notes remain readable.
3. Partially and fully canceled quantities do not appear incorrectly.
4. Repeated product lines and multiple orders consolidate to the expected totals.
5. The packing-slip QR code opens the exact order after admin sign-in.
