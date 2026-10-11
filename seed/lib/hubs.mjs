/**
 * Hub profiles.
 *
 * A hub's guide differs from the standard in four ways, and this file carries all
 * four: which segments and elements it actually requires, which code values it
 * accepts, the rules it enforces that no structure can express (timing,
 * uniqueness, cross-document matching), and the scenarios it expects a partner to
 * prove. Everything else comes from the shared X12 library.
 *
 * Override keys:
 *   segments: "TD3" or "TD3@HL-S"  ->  { usage, maxUse, note }
 *   elements: "BSN05" or "N104@N1" ->  { usage, note, values }
 *
 * All hubs and content here are fictional, written to exercise the prototype.
 */

const c = (code, description, note = null) => ({ code, description, note });
const rule = (severity, statement, rationale, appliesTo) => ({ severity, statement, rationale, appliesTo });
const sc = (name, description, requirement) => ({ name, description, requirement });

export const HUBS = [
  /* ================================================================ 1 */
  {
    slug: 'crestfield',
    partnerTerm: 'supplier',
    name: 'Crestfield Consumer Brands',
    legalName: 'Crestfield Consumer Brands, Inc.',
    industry: 'Retail and consumer packaged goods',
    about: 'A national grocery and drug retailer buying packaged goods from roughly 1,400 suppliers into eleven distribution centres.',
    attestor: { name: 'Dana Whitfield', role: 'Director, EDI Operations' },
    stdVersion: '004010',
    effectiveFrom: '2026-04-01',
    sourceDoc: 'Crestfield EDI Implementation Guide v4.2 (PDF, January 2024)',
    pages: 34,
    delimiters: { segment: '~', element: '*', component: '>', repetition: '^' },
    envelope: {
      qualifier: '01', receiverId: '078115096', appReceiverCode: 'CRESTFIELD',
      senderNote: 'Your 9-digit DUNS, left justified, space filled to 15.',
      ackRequested: '1',
      usageNote: 'T during certification, P once Crestfield confirms production cutover in writing. Sending P before cutover routes your transaction into a queue nobody watches.'
    },
    commonRules: [
      rule('reject', 'ISA15 must be T until Crestfield confirms production cutover in writing, and P thereafter.',
        'Production transactions sent during certification are not monitored, and test transactions sent after cutover are not received.', 'ISA15'),
      rule('info', 'Crestfield returns a 997 within 60 minutes of receiving an interchange. No 997 after 60 minutes should be treated as a transmission failure on your side.',
        'A silent failure is the most common reason a supplier believes a document was sent when Crestfield never received it.', 'transmission')
    ],
    contacts: [
      { role: 'EDI operations', name: 'Crestfield EDI Support', email: 'edi-support@crestfield.example', note: 'Transmission failures and 997 queries. Monday to Friday, 7am to 7pm Eastern.' },
      { role: 'Supplier onboarding', name: 'Crestfield Supplier Enablement', email: 'supplier-onboarding@crestfield.example', note: 'Certification scheduling and DC routing guides.' }
    ],
    sets: {
      '850': {
        summary: 'Crestfield issues one purchase order per distribution centre per delivery window. A supplier that cannot receive an 850 electronically cannot be set up for replenishment.',
        elements: {
          'BEG02': { values: [c('SA', 'Stand-alone order'), c('DS', 'Direct store delivery'), c('RL', 'Release against a blanket')] },
          'BEG03': { note: 'Ten digits with leading zeros preserved. Quote this number verbatim on your 855, 856 and 810.' },
          'PO106': { values: [c('UP', 'GTIN-12 (UPC)'), c('BP', "Crestfield item number")], note: 'Both pairs are sent; match on UP.' },
          'N104@N1': { note: 'Four character Crestfield DC code, for example DC12.' }
        },
        rules: [
          rule('reject', 'An 855 acknowledging the order must be transmitted within 24 hours of the 850.',
            'Crestfield treats silence as non-acceptance and reallocates the order after 24 hours.', '855 response'),
          rule('warn', 'Unit price on the 850 is the contracted price. A different price on your 810 is a price discrepancy and holds the invoice.',
            'Price disputes at invoice stage are the single largest cause of payment delay.', 'PO104')
        ],
        scenarios: [
          sc('Single DC replenishment order', 'One PO, one DC, twelve lines.', 'The baseline every supplier must process.'),
          sc('Blanket release', 'A release against an existing blanket order.', 'BEG02 = RL with the blanket number in REF.'),
          sc('Direct store delivery order', 'An order shipping to a store rather than a DC.', 'BEG02 = DS, N1*ST carries a store number not a DC code.')
        ]
      },
      '855': {
        summary: 'The acknowledgment is how Crestfield learns what will actually arrive. An 855 that accepts everything and a shipment that differs is worse than an honest rejection.',
        elements: {
          'BAK02': { values: [c('AD', 'Acknowledge with detail, no change'), c('AE', 'Acknowledge with detail and change'), c('AT', 'Accepted')] },
          'ACK01': { values: [c('IA', 'Item accepted'), c('IR', 'Item rejected'), c('IQ', 'Item accepted, quantity changed'), c('IB', 'Item backordered'), c('DR', 'Item accepted, date rescheduled')] }
        },
        rules: [
          rule('reject', 'Every PO1 line on the original order must appear with an ACK, including lines you are rejecting outright.',
            'A missing line is ambiguous: Crestfield cannot tell acceptance from an omission, and the buyer has to telephone.', 'ACK'),
          rule('reject', 'BAK03 must match the 850 purchase order number exactly, including leading zeros.',
            'An acknowledgment that cannot be matched to an open order is discarded.', 'BAK03'),
          rule('warn', 'A rescheduled date (ACK01 = DR) more than 5 days beyond the requested date requires buyer approval before shipping.',
            'Late arrival against an unapproved reschedule is charged back.', 'ACK05')
        ],
        scenarios: [
          sc('Full acceptance', 'All lines accepted as ordered.', 'Every line carries ACK01 = IA.'),
          sc('Partial quantity', 'One line short-shipped, rest accepted.', 'IQ on the short line with the quantity you will actually ship.'),
          sc('Backorder with a date', 'A line unavailable until a known date.', 'IB with ACK04 = 068 and the expected date in ACK05.')
        ]
      },
      '810': {
        summary: 'Crestfield matches every invoice three ways: to the purchase order, to the receipt, and to the contracted price. All three must agree or the invoice holds.',
        elements: {
          'BIG04': { note: 'The Crestfield PO number. An invoice without a matchable PO cannot be paid.' },
          'IT101': { note: 'Must equal the PO1 line number from the 850, so Crestfield can match line for line.' },
          'TDS01': { note: 'Implied two decimals: $1,234.56 is sent as 123456.' }
        },
        rules: [
          rule('reject', 'One invoice per purchase order per shipment. Consolidated invoices covering several POs are rejected.',
            'Crestfield reconciles payable against receipt at the PO level, and a consolidated invoice cannot be matched.', 'BIG04'),
          rule('reject', 'Invoice line quantity may not exceed the quantity Crestfield received against that PO line.',
            'Over-invoicing against receipt is the most common cause of a disputed payable.', 'IT102'),
          rule('warn', 'Invoices received more than 90 days after the ship date are subject to rejection under the supplier agreement.',
            'Late invoices fall outside the accrual period and require manual approval.', 'BIG01')
        ],
        scenarios: [
          sc('Standard invoice', 'One PO, one shipment, matching quantities.', 'The baseline.'),
          sc('Invoice with allowance', 'A promotional allowance applied at line level.', 'SAC with A and the allowance code from your trade agreement.'),
          sc('Credit memo', 'A credit against a previously invoiced shipment.', 'BIG07 = CR, referencing the original invoice in REF.')
        ]
      },
      '846': {
        summary: 'Inventory advice drives Crestfield replenishment forecasting. Stale or optimistic availability produces orders you cannot fill, and the chargebacks that follow.',
        elements: {
          'BIA02': { values: [c('NA', 'Inventory on hand, no action'), c('SI', 'Supplier inventory report')] },
          'QTY01': { values: [c('33', 'Quantity available for sale'), c('20', 'Quantity on hand'), c('99', 'Quantity on order')] }
        },
        rules: [
          rule('reject', 'Quantity available for sale (QTY01 = 33) must be reported for every item on your Crestfield item list, including items at zero.',
            'An omitted item is read as unchanged, not as out of stock, which produces orders against inventory that does not exist.', 'QTY'),
          rule('warn', 'Inventory advice must be transmitted daily before 06:00 Eastern.',
            'Replenishment planning runs at 07:00 and uses the most recent file received.', 'transmission')
        ],
        scenarios: [
          sc('Daily full file', 'Every active item with available quantity.', 'The expected daily transmission.'),
          sc('Item out of stock', 'An item temporarily unavailable.', 'Report it with quantity zero rather than omitting it.')
        ]
      },
      '852': {
        summary: 'Crestfield shares store-level movement so suppliers can plan production. This is data Crestfield sends; there is nothing to build on the outbound side.',
        elements: {
          'XQ01': { values: [c('F', 'Final')] },
          'ZA01': { values: [c('QS', 'Quantity sold'), c('QO', 'Quantity on hand'), c('QR', 'Quantity received'), c('QT', 'Quantity in transit')] }
        },
        rules: [
          rule('info', 'Product activity is sent weekly on Monday covering the prior Sunday to Saturday week.',
            'Weekly cadence matches the replenishment planning cycle.', 'transmission'),
          rule('info', 'Quantities are reported at the DC, not by store. Store level detail is available under a separate agreement.',
            'Store level files are an order of magnitude larger and are not sent by default.', 'ZA02')
        ],
        scenarios: [
          sc('Weekly movement file', 'One week of sold, on hand and received quantities.', 'Consume all three activity codes.')
        ]
      },
      '997': {
        summary: 'Crestfield returns a 997 for every interchange received and expects one for every interchange sent. A missing 997 is how both sides detect a dropped transmission.',
        elements: {
          'AK501': { values: [c('A', 'Accepted'), c('E', 'Accepted with errors'), c('R', 'Rejected')] },
          'AK901': { values: [c('A', 'Accepted'), c('E', 'Accepted with errors'), c('R', 'Rejected'), c('P', 'Partially accepted')] }
        },
        rules: [
          rule('reject', 'A 997 must be returned within 60 minutes of receiving any Crestfield interchange.',
            'Crestfield escalates an unacknowledged interchange to its operations team after 60 minutes.', 'transmission'),
          rule('warn', 'Never return a 997 in response to a 997.',
            'Acknowledging an acknowledgment creates a loop that fills both mailboxes.', 'AK101')
        ],
        scenarios: [
          sc('Clean acceptance', 'An interchange with no syntax errors.', 'AK901 = A with counts that agree.'),
          sc('Rejected transaction within an accepted group', 'One transaction fails, others pass.', 'AK501 = R for the failing transaction, AK901 = P for the group.')
        ]
      }
    }
  },

  /* ================================================================ 2 */
  {
    slug: 'halverson-motors',
    partnerTerm: 'supplier',
    name: 'Halverson Motors',
    legalName: 'Halverson Motor Corporation',
    industry: 'Automotive manufacturing',
    about: 'A vehicle manufacturer running three assembly plants on sequenced just-in-time supply, buying from roughly 600 tier one suppliers.',
    attestor: { name: 'Priya Raghunathan', role: 'Manager, Supplier Systems Integration' },
    stdVersion: '004010',
    effectiveFrom: '2026-01-05',
    sourceDoc: 'Halverson Motors Supplier EDI Standard, Revision 11 (PDF, September 2025)',
    pages: 86,
    delimiters: { segment: '~', element: '*', component: ':', repetition: '^' },
    envelope: {
      qualifier: '01', receiverId: '042118770', appReceiverCode: 'HALVERSON',
      senderNote: 'Your DUNS. Halverson does not accept mutually defined (ZZ) qualifiers.',
      ackRequested: '1',
      usageNote: 'T throughout the test phase. Halverson schedules production cutover per plant, so a supplier may be P for one plant and T for another during a phased launch.'
    },
    commonRules: [
      rule('reject', 'Every transaction must carry the Halverson supplier code in REF*ZZ at header level.',
        'The DUNS in the envelope identifies the corporate entity; the supplier code identifies the shipping location, and Halverson routes on the latter.', 'REF'),
      rule('reject', 'Cumulative quantities are reset annually on 1 January. A cumulative figure carried across the year boundary will not reconcile.',
        'Halverson closes cumulative accounting at year end, and a carried figure produces a false overship.', 'cumulative accounting'),
      rule('info', 'Halverson returns a 997 within 30 minutes. Transmission windows close at 23:00 plant local time and reopen at 04:00.',
        'The overnight window is reserved for the MRP run, and transmissions during it queue rather than process.', 'transmission')
    ],
    contacts: [
      { role: 'Supplier systems', name: 'Halverson EDI Helpdesk', email: 'edi-helpdesk@halverson.example', note: '24 hours during production, excluding plant shutdown weeks.' },
      { role: 'Materials planning', name: 'Plant Materials Group', email: 'materials@halverson.example', note: 'Release quantity and schedule questions.' }
    ],
    sets: {
      '830': {
        summary: 'The planning schedule is the supplier’s authorisation to build and buy. Firm buckets inside the fence are a commitment Halverson will pay for; planning buckets are not.',
        segments: { 'SHP': { usage: 'required', note: 'Cumulative received quantity as Halverson has it. Reconcile this against your cumulative shipped before acting on the schedule.' } },
        elements: {
          'BFR05': { values: [c('C', 'Cumulative quantities')], note: 'Halverson schedules are always cumulative. Discrete interpretation will double your shipments.' },
          'LIN04': { usage: 'required', note: 'Engineering change level. Shipping against a superseded level is a quality incident, not a paperwork error.' },
          'FST02': { values: [c('C', 'Firm'), c('D', 'Planning')], note: 'Firm inside the 10 day fence, planning beyond it.' },
          'FST03': { values: [c('D', 'Discrete, a specific day'), c('W', 'Weekly bucket'), c('M', 'Monthly bucket')] }
        },
        rules: [
          rule('reject', 'Quantities are cumulative from the start of the model year, not discrete per release.',
            'Treating a cumulative schedule as discrete is the single most expensive integration error in automotive EDI, and it overships within one week.', 'FST01'),
          rule('reject', 'The engineering change level in LIN04 and LIN05 must match the level on the parts you ship.',
            'Halverson line-side verification rejects a part at the wrong change level, and the line stops.', 'LIN05'),
          rule('warn', 'Requirements inside the 10 day firm fence are a commitment. Changes inside the fence are negotiated by telephone, not by EDI.',
            'Material and labour are already committed inside the fence.', 'FST02'),
          rule('info', 'A planning schedule replaces the previous one in full. There is no incremental update.',
            'Merging a new schedule into an old one produces phantom requirements.', 'BFR01')
        ],
        scenarios: [
          sc('Weekly schedule refresh', 'A full horizon with firm days and planning weeks.', 'Replace the prior schedule entirely; do not merge.'),
          sc('Cumulative reconciliation', 'Halverson cumulative received differs from your cumulative shipped.', 'Reconcile before shipping and raise the variance with materials planning.'),
          sc('Engineering change cutover', 'A part transitions to a new change level mid-horizon.', 'Two LIN loops for the same part number at different change levels, each with its own requirements.')
        ]
      },
      '862': {
        summary: 'The shipping schedule is the firm ship authorisation inside the planning horizon. The 830 says what to plan for; the 862 says what to put on the truck.',
        elements: {
          'BSS04': { values: [c('DL', 'Delivery based')], note: 'Dates are delivery dates at the plant dock, not ship dates. Work backwards using your transit time.' },
          'FST02': { values: [c('C', 'Firm')], note: 'Everything on an 862 is firm by definition.' }
        },
        rules: [
          rule('reject', 'Dates are required delivery dates at the receiving dock. Shipping on the date given will be late.',
            'Halverson plans dock receipt, not supplier despatch, and a shipment arriving on the requirement date has already missed the line.', 'FST04'),
          rule('reject', 'An 862 supersedes any overlapping requirement in the most recent 830 for the same part.',
            'Acting on both produces a double shipment.', 'BSS01'),
          rule('warn', 'Delivery outside the appointment window stated in the plant routing guide is refused at the gate.',
            'Dock capacity is sequenced, and an unscheduled trailer blocks a scheduled one.', 'delivery')
        ],
        scenarios: [
          sc('Daily firm release', 'A normal day of firm requirements.', 'Treat every date as a dock delivery date.'),
          sc('Expedite inside transit time', 'A requirement dated sooner than your normal transit.', 'Contact materials planning rather than shipping short.')
        ]
      },
      '856': {
        summary: 'Halverson receives against the ASN at the dock using AIAG labels. The ASN must be transmitted at despatch, not on arrival, because receiving opens on the ASN.',
        segments: {
          'TD3@HL-S': { usage: 'required', note: 'Trailer number is required on every shipment, including supplier-operated vehicles.' },
          'PO4@HL-P': { usage: 'required', note: 'Container type and quantity per container, matching the physical pack.' }
        },
        elements: {
          'BSN05': { values: [c('0001', 'Shipment, Order, Packaging, Item')], note: 'Pack level is mandatory. Halverson scans container labels.' },
          'MAN01': { values: [c('GM', 'SSCC-18'), c('AI', 'AIAG container serial')], note: 'AI is accepted only for plants still on the legacy label standard; confirm with your plant contact.' },
          'LIN02': { values: [c('BP', "Halverson part number")], note: 'Part number only. Halverson does not use UPC on production material.' },
          'LIN04': { usage: 'required', values: [c('EC', 'Engineering change level')], note: 'Required on every item level.' }
        },
        rules: [
          rule('reject', 'The ASN must be transmitted within 30 minutes of despatch and before the trailer arrives at the plant.',
            'Receiving opens on the ASN. A trailer that arrives first waits at the gate and the delay is recorded against your supplier scorecard.', 'transmission'),
          rule('reject', 'Each pack level must carry the container serial printed on the AIAG label, matching digit for digit.',
            'Dock scanning matches the label to the pack level; a mismatch means the container is received by hand.', 'HL-P/MAN02'),
          rule('reject', 'The engineering change level on the ASN must match the level on the physical parts.',
            'A change level mismatch is a containment event at Halverson, not a correction.', 'LIN05'),
          rule('warn', 'Quantity shipped may not exceed the firm requirement by more than one standard pack.',
            'Overshipment against a cumulative schedule inflates the cumulative and disrupts the next release.', 'SN102')
        ],
        scenarios: [
          sc('Single part, single destination', 'One part number to one plant dock.', 'The baseline for every new supplier.'),
          sc('Mixed load to two docks at one plant', 'Parts for two receiving docks on one trailer.', 'One shipment level, separate order levels per dock, with the dock in N1*ST.'),
          sc('Change level transition shipment', 'Both old and new change levels on one trailer.', 'Separate item levels per change level, never combined.'),
          sc('Returnable container shipment', 'Parts in returnable racks.', 'PO4 carries the rack type; the rack serial goes in the pack level MAN.')
        ]
      },
      '810': {
        summary: 'Halverson pays on receipt against the ASN, so the invoice reconciles to received quantity rather than to shipped quantity.',
        elements: {
          'BIG04': { note: 'The Halverson release or purchase order number from the schedule.' },
          'IT106': { values: [c('BP', 'Halverson part number')] }
        },
        rules: [
          rule('reject', 'Invoice quantity must equal the quantity Halverson received against the referenced ASN.',
            'Payment is triggered by receipt, so an invoice that disagrees with receipt cannot be matched and is returned.', 'IT102'),
          rule('reject', 'Each invoice references exactly one ASN shipment identifier in REF*SI.',
            'Halverson reconciles payable per shipment; a multi-shipment invoice cannot be matched.', 'REF'),
          rule('info', 'Halverson operates evaluated receipt settlement for suppliers on the self-billing programme. Those suppliers do not send an 810 at all.',
            'Sending an invoice while on self-billing produces a duplicate payable.', 'programme')
        ],
        scenarios: [
          sc('Invoice against one ASN', 'Standard production material invoice.', 'One ASN, one invoice, quantities matching receipt.'),
          sc('Price variance', 'Contracted price changed mid-month.', 'Invoice at the contracted price for the ship date, not the invoice date.')
        ]
      },
      '820': {
        summary: 'Halverson sends remittance detail for every payment. This is inbound to the supplier; there is nothing to build on the outbound side.',
        elements: {
          'BPR01': { values: [c('I', 'Remittance information only')], note: 'Funds move separately by ACH. This document is advice, not payment.' },
          'RMR01': { values: [c('IV', 'Invoice number'), c('SI', 'Shipment identifier')], note: 'Self-billing suppliers are remitted against the shipment identifier, since no invoice exists.' }
        },
        rules: [
          rule('info', 'Remittance is transmitted on the payment effective date, which may be up to two business days before funds settle.',
            'Matching remittance to a bank statement on the same day will not reconcile.', 'BPR16'),
          rule('info', 'Adjustments carry an ADX with the reason code. A short payment with no ADX is a transmission problem, not a deduction.',
            'Unexplained short payments generate avoidable supplier enquiries.', 'ADX')
        ],
        scenarios: [
          sc('Standard remittance', 'One payment covering several invoices.', 'One RMR per invoice.'),
          sc('Self-billing remittance', 'Payment against shipments with no invoice.', 'RMR01 = SI referencing the ASN shipment identifier.'),
          sc('Payment with a deduction', 'A quality debit applied against the payment.', 'ADX carries the amount and reason code.')
        ]
      },
      '824': {
        summary: 'The application advice reports whether a transaction passed Halverson business validation after it passed syntax. A 997 acceptance does not mean the document was usable.',
        elements: {
          'OTI01': { values: [c('TA', 'Transaction accepted'), c('TR', 'Transaction rejected'), c('TE', 'Transaction accepted with errors')] },
          'OTI02': { values: [c('SI', 'Shipment identifier'), c('IV', 'Invoice number'), c('PO', 'Purchase order number')] }
        },
        rules: [
          rule('reject', 'An 824 reporting TR means the transaction was not processed. Resend a corrected document; do not assume it will be reprocessed.',
            'Rejected transactions are not queued for retry, and suppliers frequently assume they are.', 'OTI01'),
          rule('warn', 'An 824 may arrive up to four hours after the 997 for the same transaction.',
            'Syntax validation is immediate; business validation runs against plant data on a schedule.', 'timing')
        ],
        scenarios: [
          sc('ASN rejected for unknown part', 'An ASN citing a part not on the current schedule.', 'TR with a TED identifying the part.'),
          sc('Invoice accepted with a price warning', 'Invoice processed but priced differently.', 'TE with the variance in TED.')
        ]
      },
      '997': {
        summary: 'Syntax acknowledgment only. Halverson treats a missing 997 as a failed transmission and re-sends automatically after 30 minutes.',
        elements: {
          'AK501': { values: [c('A', 'Accepted'), c('E', 'Accepted with errors'), c('R', 'Rejected')] }
        },
        rules: [
          rule('reject', 'Return a 997 within 30 minutes of any Halverson interchange.',
            'Halverson re-sends unacknowledged interchanges automatically, and a late acknowledgment produces duplicates on your side.', 'transmission'),
          rule('warn', 'A 997 acceptance confirms syntax only. Business acceptance arrives separately as an 824.',
            'Suppliers routinely treat an accepted 997 as confirmation that a shipment was recognised, which it is not.', 'AK501')
        ],
        scenarios: [
          sc('Acknowledging a schedule', 'A received 830 or 862.', 'AK901 = A within 30 minutes.')
        ]
      }
    }
  },

  /* ================================================================ 3 */
  {
    slug: 'northwind-grocery',
    partnerTerm: 'supplier',
    name: 'Northwind Grocery Group',
    legalName: 'Northwind Grocery Group LLC',
    industry: 'Grocery retail',
    about: 'A regional grocery chain of 340 stores with four distribution centres and a large direct store delivery programme.',
    attestor: { name: 'Marcus Oyelaran', role: 'Senior Manager, Supply Chain Systems' },
    stdVersion: '005010',
    effectiveFrom: '2026-02-16',
    sourceDoc: 'Northwind Trading Partner Guidelines v7.1 (PDF, March 2025)',
    pages: 52,
    delimiters: { segment: '~', element: '*', component: '>', repetition: 'U' },
    envelope: {
      qualifier: '01', receiverId: '601994388', appReceiverCode: 'NWGROCERY',
      senderNote: 'DUNS, or DUNS plus 4 for suppliers with multiple shipping points.',
      ackRequested: '1',
      usageNote: 'T until Northwind confirms production in writing. Northwind runs a two week parallel period during which both T and P are accepted.'
    },
    commonRules: [
      rule('reject', 'Northwind is on 005010. Transactions at 004010 are rejected at the group level.',
        'Northwind migrated in 2024 and does not maintain a 004010 translator.', 'GS08'),
      rule('warn', 'Catch weight items must carry actual weight, not nominal. Nominal weight on a variable weight item produces an invoice discrepancy at receipt.',
        'Random weight product is received by weight and invoiced by weight.', 'catch weight')
    ],
    contacts: [
      { role: 'EDI support', name: 'Northwind EDI Team', email: 'edi@northwindgrocery.example', note: '6am to 8pm Central, seven days.' },
      { role: 'DSD programme', name: 'Direct Store Delivery Office', email: 'dsd@northwindgrocery.example', note: 'Store routing and delivery windows.' }
    ],
    sets: {
      '850': {
        summary: 'Northwind orders to a delivery window rather than a date. The window, not the order date, drives everything downstream.',
        elements: {
          'BEG02': { values: [c('SA', 'Stand-alone order'), c('DS', 'Direct store delivery'), c('CF', 'Confirmation')] },
          'DTM01': { values: [c('002', 'Requested delivery'), c('038', 'Ship not before'), c('063', 'Do not deliver after')], note: 'All three are sent. The pair 038 and 063 is the delivery window.' },
          'PO106': { values: [c('UP', 'GTIN-12'), c('UK', 'GTIN-14 case code'), c('VN', "Supplier's item number")] }
        },
        rules: [
          rule('reject', 'Delivery outside the window bounded by DTM*038 and DTM*063 is refused at the DC door.',
            'Northwind schedules dock labour against the window and has no capacity for early or late arrivals.', 'DTM'),
          rule('reject', 'Case code (UK) is required for every line destined to a DC. Direct store delivery lines may use UP.',
            'DC receiving scans the case, not the consumer unit.', 'PO106'),
          rule('warn', 'An order may contain both DC and store destination lines. Do not assume one destination per order.',
            'Suppliers who assume a single ship-to misroute the store lines.', 'N1')
        ],
        scenarios: [
          sc('DC replenishment order', 'Cases to one distribution centre inside a two day window.', 'The baseline.'),
          sc('Direct store delivery order', 'Consumer units direct to a store.', 'BEG02 = DS, store number in N1*ST, UP rather than UK.'),
          sc('Mixed destination order', 'DC lines and store lines on one order.', 'Per-line destination, not per-order.')
        ]
      },
      '856': {
        summary: 'Northwind receives by pallet at the DC and by case at the store. The hierarchy you send has to match how the goods are physically built.',
        elements: {
          'BSN05': { values: [c('0001', 'Shipment, Order, Packaging, Item'), c('0004', 'Shipment, Order, Item')], note: '0001 for DC deliveries. 0004 is accepted for direct store delivery only, where there is no pallet.' },
          'MAN01': { values: [c('GM', 'SSCC-18')], note: 'One SSCC per pallet for DC shipments.' },
          'TD504': { values: [c('M', 'Motor'), c('LT', 'Less than trailer'), c('SR', 'Supplier vehicle'), c('CE', 'Customer pickup')] }
        },
        rules: [
          rule('reject', 'DC shipments require hierarchy 0001 with one pack level per pallet. Store deliveries use 0004.',
            'DC receiving scans pallet labels; store receiving counts cases by hand.', 'BSN05'),
          rule('reject', 'Catch weight items must report actual shipped weight in the item level, not the nominal case weight.',
            'Northwind invoices random weight product on actual weight, and a nominal figure guarantees a discrepancy.', 'HL-I/SN102'),
          rule('reject', 'The ASN must arrive at least two hours before the trailer, or at despatch for deliveries inside a two hour transit.',
            'Two hours is the minimum to build a receiving plan and assign a door.', 'transmission'),
          rule('warn', 'A pallet containing more than one item requires an item level per item, with quantities summing to the pallet quantity.',
            'Mixed pallets received against a single item line produce an inventory variance in every affected item.', 'HL-I')
        ],
        scenarios: [
          sc('Single pallet, single item', 'One full pallet of one product to a DC.', 'The baseline.'),
          sc('Mixed pallet', 'One pallet with four products.', 'One pack level, four item levels beneath it.'),
          sc('Direct store delivery', 'Cases delivered to a store from a route truck.', 'Hierarchy 0004, no pack level, store number in N1*ST.'),
          sc('Catch weight shipment', 'Random weight product such as cheese or meat.', 'Actual weight per item level.')
        ]
      },
      '855': {
        summary: 'Northwind needs the acknowledgment inside four hours because the delivery window is often inside 48.',
        elements: {
          'ACK01': { values: [c('IA', 'Item accepted'), c('IR', 'Item rejected'), c('IQ', 'Quantity changed'), c('IS', 'Item substituted')] }
        },
        rules: [
          rule('reject', 'Acknowledge within four hours of receiving the 850.',
            'Delivery windows are frequently inside 48 hours, so a late acknowledgment leaves no time to source elsewhere.', '855 response'),
          rule('warn', 'A substitution (IS) requires a pre-approved substitute on the Northwind item file. Unapproved substitutes are refused at the door.',
            'Store planograms and retail pricing are set per item.', 'ACK01')
        ],
        scenarios: [
          sc('Full acceptance', 'All lines as ordered.', 'Inside four hours.'),
          sc('Approved substitution', 'A pre-approved alternate pack size.', 'IS with the substitute item in a following LIN.')
        ]
      },
      '810': {
        summary: 'Northwind invoices settle against receipt weight for catch weight items and against receipt count for everything else.',
        elements: {
          'IT106': { values: [c('UK', 'GTIN-14 case code'), c('UP', 'GTIN-12')] },
          'BIG04': { note: 'Northwind PO number. One invoice per PO per delivery.' }
        },
        rules: [
          rule('reject', 'Catch weight lines must invoice on actual received weight.',
            'Invoicing nominal weight on random weight product creates a deduction on every single line.', 'IT102'),
          rule('warn', 'Promotional allowances must appear as SAC at line level, not as a reduced unit price.',
            'Northwind reconciles promotional spend separately from cost of goods, and a netted price makes that impossible.', 'SAC')
        ],
        scenarios: [
          sc('Standard case invoice', 'Fixed weight product.', 'The baseline.'),
          sc('Catch weight invoice', 'Random weight product.', 'Actual weight from the receipt.'),
          sc('Invoice with promotion', 'A temporary price reduction.', 'SAC at line level with the agreed allowance code.')
        ]
      },
      '852': {
        summary: 'Northwind sends weekly movement by DC so suppliers can plan production and promotions.',
        elements: {
          'ZA01': { values: [c('QS', 'Quantity sold'), c('QO', 'Quantity on hand'), c('QR', 'Quantity received')] }
        },
        rules: [
          rule('info', 'Movement is sent Tuesday morning covering the prior Monday to Sunday week.',
            'The file is produced after weekend store polling completes.', 'transmission')
        ],
        scenarios: [
          sc('Weekly movement', 'Sold, on hand and received by DC.', 'Consume all three codes.')
        ]
      },
      '997': {
        summary: 'Required in both directions within two hours.',
        rules: [
          rule('reject', 'Return a 997 within two hours of any Northwind interchange.',
            'Northwind escalates unacknowledged interchanges to the supplier contact on file.', 'transmission')
        ],
        scenarios: [
          sc('Standard acknowledgment', 'A received order.', 'AK901 = A within two hours.')
        ]
      }
    }
  },

  /* ================================================================ 4 */
  {
    slug: 'vantage-logistics',
    partnerTerm: 'carrier',
    name: 'Vantage Logistics Group',
    legalName: 'Vantage Logistics Group, Inc.',
    industry: 'Third party logistics and transportation',
    about: 'An asset-light 3PL tendering freight to roughly 900 carriers and operating eleven contract warehouses for shipper clients.',
    attestor: { name: 'Ingrid Sollis', role: 'VP, Network Systems' },
    stdVersion: '004010',
    effectiveFrom: '2026-03-02',
    sourceDoc: 'Vantage Carrier and Warehouse EDI Specification v9 (PDF, November 2025)',
    pages: 61,
    delimiters: { segment: '~', element: '*', component: '>', repetition: '^' },
    envelope: {
      qualifier: 'ZZ', receiverId: 'VANTAGELG', appReceiverCode: 'VANTAGE',
      senderNote: 'Carriers use their SCAC. Warehouse operators use the Vantage site code.',
      ackRequested: '1',
      usageNote: 'T during onboarding. Vantage certifies per lane for carriers and per site for warehouses.'
    },
    commonRules: [
      rule('reject', 'Times are local to the event location and must carry the time zone in the time code element where the segment provides one.',
        'A status without a zone cannot be ordered against other events, and Vantage operates across four zones.', 'time zones'),
      rule('info', 'Vantage returns a 997 within 15 minutes. Transmissions are accepted 24 hours a day with no maintenance window.',
        'Freight moves overnight, so the interface does not close.', 'transmission')
    ],
    contacts: [
      { role: 'Carrier systems', name: 'Vantage Carrier EDI', email: 'carrier-edi@vantagelogistics.example', note: '24 hours.' },
      { role: 'Warehouse systems', name: 'Vantage WMS Integration', email: 'wms-edi@vantagelogistics.example', note: '7am to 9pm Central.' }
    ],
    sets: {
      '204': {
        summary: 'The load tender offers a specific load at a specific rate. A carrier that does not respond within the response window loses the load automatically.',
        elements: {
          'B2A01': { values: [c('00', 'Original tender'), c('01', 'Cancellation'), c('04', 'Change to a tendered load')] },
          'B206': { values: [c('PP', 'Prepaid'), c('TP', 'Third party')], note: 'Vantage does not tender collect freight.' },
          'S502': { values: [c('LD', 'Load'), c('UL', 'Unload')] },
          'G6201': { values: [c('37', 'Earliest arrival'), c('38', 'Latest arrival'), c('02', 'Requested delivery')], note: 'The pair 37 and 38 is the appointment window at that stop.' }
        },
        rules: [
          rule('reject', 'Respond with a 990 within 30 minutes of the tender. Vantage re-tenders to the next carrier automatically after 30 minutes.',
            'Loads are tendered in rate order against a departure clock, so an unanswered tender moves on.', '990 response'),
          rule('reject', 'Stop sequence numbers must be processed in the order given. Vantage sequences stops by route, not by geography.',
            'Resequencing a multi-stop load breaks appointment times at every stop after the change.', 'S501'),
          rule('reject', 'A change tender (B2A01 = 04) replaces the original in full. Merge it and you will run the wrong route.',
            'Changes frequently alter stop count, so a merge produces a load that exists nowhere in the plan.', 'B2A01'),
          rule('warn', 'Appointment windows at a stop are firm. Arriving outside the window may forfeit the stop and the associated pay.',
            'Receiving sites schedule doors, and Vantage is charged for a missed appointment.', 'G62')
        ],
        scenarios: [
          sc('Single pickup, single delivery', 'A straightforward point to point load.', 'The baseline for carrier certification.'),
          sc('Multi-stop load', 'One pickup and three deliveries.', 'Four stops in Vantage sequence, each with its own window.'),
          sc('Change tender before pickup', 'A stop added after the original tender.', 'Replace the load entirely, do not merge.'),
          sc('Cancellation', 'The load is pulled before pickup.', 'B2A01 = 01 referencing the original shipment identifier.')
        ]
      },
      '990': {
        summary: 'Accept or decline. A 990 that neither accepts nor declines cleanly is treated as a decline.',
        elements: {
          'B104': { values: [c('A', 'Accept'), c('D', 'Decline')] }
        },
        rules: [
          rule('reject', 'Respond within 30 minutes of the tender.',
            'After 30 minutes the load is re-tendered and your acceptance will be rejected as stale.', 'transmission'),
          rule('reject', 'B102 must carry the shipment identifier from the 204 exactly.',
            'A response that cannot be matched to a tender is discarded without notice.', 'B102'),
          rule('warn', 'Accepting a load you cannot cover is worse than declining. Vantage tracks acceptance-then-fallthrough separately from decline rate, and it affects lane awards.',
            'A fallthrough leaves no time to re-tender.', 'B104')
        ],
        scenarios: [
          sc('Accept a tender', 'Carrier takes the load.', 'A with the shipment identifier.'),
          sc('Decline a tender', 'Carrier passes.', 'D, sent immediately rather than at the deadline.')
        ]
      },
      '214': {
        summary: 'Status messages are how Vantage and its shipper clients see the load. Missing milestones are the most common reason a carrier loses a lane.',
        elements: {
          'AT701': { values: [
            c('AF', 'Carrier departed pickup'), c('X3', 'Arrived at delivery'), c('CD', 'Carrier departed delivery'),
            c('X1', 'Arrived at pickup'), c('D1', 'Completed delivery'), c('AG', 'Estimated delivery'),
            c('SD', 'Shipment delayed'), c('A3', 'Shipment returned')
          ] },
          'AT702': { note: 'Required whenever AT701 is SD. A delay with no reason generates a call to your dispatch desk.' },
          'AT708': { note: 'Time zone of the event location, not of your dispatch office.' }
        },
        rules: [
          rule('reject', 'Four milestones are mandatory on every load: arrived at pickup, departed pickup, arrived at delivery, delivery complete.',
            'Vantage clients are billed on proof of these events, and a missing milestone cannot be reconstructed later.', 'AT701'),
          rule('reject', 'A status must be transmitted within 15 minutes of the event. Batched end-of-day status files are rejected.',
            'Status is used to manage the load in flight; a status that arrives after the fact has no operational value.', 'transmission'),
          rule('reject', 'Every status carries the event time zone in AT708.',
            'Vantage operates across four time zones, and a status without a zone cannot be sequenced against the others.', 'AT708'),
          rule('warn', 'A delay status (SD) must carry a reason code and a revised estimated delivery within 30 minutes.',
            'A delay with no new estimate forces a manual call to the driver.', 'AT702')
        ],
        scenarios: [
          sc('Clean run', 'The four mandatory milestones on a single-stop load.', 'Certification baseline.'),
          sc('Multi-stop status', 'Arrival and departure at each of three stops.', 'Stop sequence carried in L11.'),
          sc('Delay with recovery', 'A breakdown, then recovery and delivery.', 'SD with reason, revised estimate, then normal milestones.'),
          sc('Attempted delivery refused', 'Receiver turns the load away.', 'A3 with the reason, then disposition instructions by telephone.')
        ]
      },
      '940': {
        partnerTerm: 'warehouse',
        summary: 'The shipping order instructs a Vantage warehouse to pick and ship on behalf of a shipper client. Warehouses receive this; carriers do not.',
        elements: {
          'W0501': { values: [c('N', 'New order'), c('F', 'Final, no further releases')] },
          'W0103': { values: [c('UP', 'GTIN-12'), c('UK', 'GTIN-14'), c('VN', 'Client item number')] }
        },
        rules: [
          rule('reject', 'Acknowledge receipt with a 997 and report the outcome with a 945. A 940 with no 945 within 24 hours is escalated to the site manager.',
            'The shipper client sees inventory move only when the 945 arrives.', '945 response'),
          rule('warn', 'Partial shipment is permitted unless the order is marked final. A final order must ship complete or be reported short.',
            'Clients plan replenishment against complete orders.', 'W0501')
        ],
        scenarios: [
          sc('Standard pick and ship', 'A full order shipped complete.', 'The baseline.'),
          sc('Short ship on a final order', 'Insufficient inventory on a final order.', 'Ship what exists and report the shortfall on the 945.')
        ]
      },
      '945': {
        partnerTerm: 'warehouse',
        summary: 'The shipping advice closes the loop on a 940 and is what moves inventory in the client system.',
        elements: {
          'W0601': { values: [c('F', 'Final shipment'), c('N', 'New shipment against an open order')] },
          'W1201': { values: [c('CL', 'Line shipped complete'), c('PR', 'Partial shipment'), c('BP', 'Line backordered')] }
        },
        rules: [
          rule('reject', 'Report every line from the 940, including lines that shipped nothing.',
            'An omitted line leaves the client order open indefinitely with no indication why.', 'W12'),
          rule('reject', 'Transmit within two hours of the trailer departing the site.',
            'The client releases the downstream ASN from this document.', 'transmission'),
          rule('warn', 'Pallet SSCCs in MAN must match the labels applied in the warehouse.',
            'The receiving site scans those labels, and a mismatch means hand receipt.', 'MAN')
        ],
        scenarios: [
          sc('Complete shipment', 'Everything on the order shipped.', 'All lines CL.'),
          sc('Partial with backorder', 'Some lines short.', 'PR and BP as appropriate, every line reported.')
        ]
      },
      '997': {
        summary: 'Required within 15 minutes in both directions.',
        rules: [
          rule('reject', 'Return a 997 within 15 minutes.',
            'Vantage treats an unacknowledged tender as undelivered and re-tenders it.', 'transmission')
        ],
        scenarios: [
          sc('Acknowledging a tender', 'A received 204.', 'AK901 = A within 15 minutes, followed by the 990.')
        ]
      }
    }
  },

  /* ================================================================ 5 */
  {
    slug: 'pallas-health',
    partnerTerm: 'supplier',
    name: 'Pallas Health System',
    legalName: 'Pallas Health System',
    industry: 'Healthcare provider supply chain',
    about: 'An integrated delivery network of 22 hospitals and 140 clinics, buying medical and surgical supplies through a consolidated service centre.',
    attestor: { name: 'Theo Alsager', role: 'Director, Supply Chain Technology' },
    stdVersion: '005010',
    effectiveFrom: '2026-05-01',
    sourceDoc: 'Pallas Supplier Integration Guide, 2026 Edition (PDF, December 2025)',
    pages: 71,
    delimiters: { segment: '~', element: '*', component: '>', repetition: '^' },
    envelope: {
      qualifier: '01', receiverId: '113440287', appReceiverCode: 'PALLASHS',
      senderNote: 'DUNS. Pallas also accepts GLN (qualifier UL) for suppliers standardised on GS1.',
      ackRequested: '1',
      usageNote: 'T until Pallas confirms production. Pallas certifies per transaction set, not per supplier, so you may be live on 850 while still testing 856.'
    },
    commonRules: [
      rule('reject', 'Every item must be identified by GTIN. Pallas does not accept supplier catalogue numbers as the sole identifier on any transaction.',
        'Pallas standardised on GS1 in 2024, and recall management depends on a single item identity across every document.', 'item identification'),
      rule('reject', 'Lot number and expiry date are required for every item subject to recall or dating, on both the ASN and the invoice.',
        'Recall response time is a patient safety measure and a regulatory obligation, and it depends on lot traceability at receipt.', 'lot traceability'),
      rule('info', 'Pallas returns a 997 within one hour, and an 824 for business validation on 850, 856 and 810.',
        'Two stage validation means an accepted 997 does not confirm the document was usable.', 'transmission')
    ],
    contacts: [
      { role: 'Supplier integration', name: 'Pallas Supply Chain Technology', email: 'supplier-edi@pallashealth.example', note: '7am to 6pm Central, Monday to Friday.' },
      { role: 'Item master', name: 'Pallas Item Data Team', email: 'itemdata@pallashealth.example', note: 'GTIN, UOM and contract price alignment.' }
    ],
    sets: {
      '850': {
        summary: 'Pallas orders against contracted price. An order is also the point where contract and item master misalignment surfaces, so most onboarding failures appear here first.',
        elements: {
          'PO106': { values: [c('UK', 'GTIN-14'), c('UP', 'GTIN-12'), c('N4', 'NDC for pharmaceutical items')], note: 'GTIN is required. NDC is additional, not a substitute.' },
          'REF01': { values: [c('CT', 'Contract number'), c('PD', 'Promotion or deal number'), c('ZZ', 'Pallas requisition number')] },
          'N104@N1': { note: 'Pallas facility code, six characters. Each hospital and clinic has its own, and they are not interchangeable.' }
        },
        rules: [
          rule('reject', 'Unit price must match the active contract price for the order date. A price mismatch is rejected rather than queried.',
            'Pallas purchases under GPO contracts, and off-contract pricing breaks the rebate reconciliation.', 'PO104'),
          rule('reject', 'Unit of measure must match the contracted unit. Shipping an each against a contracted case is a receipt discrepancy on every line.',
            'UOM mismatch is the most common cause of an unmatched receipt in healthcare supply.', 'PO103'),
          rule('warn', 'Orders flagged for a clinical hold carry REF*ZZ with the requisition number and must not be shipped before confirmation.',
            'Clinical holds exist where an item substitution needs clinician approval.', 'REF')
        ],
        scenarios: [
          sc('Standard contract order', 'Items on an active GPO contract to one facility.', 'The baseline.'),
          sc('Multi-facility order', 'One order with lines for three facilities.', 'Per-line facility, carried in the line level N1.'),
          sc('Pharmaceutical order', 'Items identified by both GTIN and NDC.', 'Both identifiers on the line.')
        ]
      },
      '855': {
        summary: 'Pallas needs to know about substitutions and backorders quickly, because a clinical item that will not arrive has to be sourced before a procedure.',
        elements: {
          'ACK01': { values: [c('IA', 'Accepted'), c('IR', 'Rejected'), c('IQ', 'Quantity changed'), c('IB', 'Backordered'), c('IS', 'Substituted')] }
        },
        rules: [
          rule('reject', 'Acknowledge within 12 hours. Items flagged as clinical critical require acknowledgment within two hours.',
            'A critical item that will not arrive has to be sourced before a scheduled procedure.', '855 response'),
          rule('reject', 'A substitution must carry the substitute GTIN. A substitution identified only by description is rejected.',
            'Pallas validates a substitute against the clinical equivalence list by GTIN.', 'ACK01'),
          rule('warn', 'A backorder must carry an expected availability date. A backorder with no date is escalated to the category manager.',
            'Without a date Pallas cannot decide whether to source elsewhere.', 'ACK05')
        ],
        scenarios: [
          sc('Full acceptance', 'All lines as ordered.', 'The baseline.'),
          sc('Clinical substitution', 'An equivalent item offered.', 'IS with the substitute GTIN.'),
          sc('Critical item backorder', 'A clinical critical item unavailable.', 'IB with a date, inside two hours.')
        ]
      },
      '856': {
        summary: 'The ASN carries the lot and expiry data that makes a recall actionable. Pallas receives against it at the consolidated service centre.',
        segments: { 'REF@HL-I': { usage: 'required', note: 'Lot number and expiry date at item level.' } },
        elements: {
          'BSN05': { values: [c('0001', 'Shipment, Order, Packaging, Item')] },
          'LIN02': { values: [c('UK', 'GTIN-14'), c('UP', 'GTIN-12')] },
          'REF01@HL-I': { values: [c('LT', 'Lot number'), c('EX', 'Expiry date, CCYYMMDD')], note: 'Both required for dated or recallable items.' },
          'MAN01': { values: [c('GM', 'SSCC-18')] }
        },
        rules: [
          rule('reject', 'Lot number and expiry date are required at item level for every dated or recallable item.',
            'Pallas must be able to identify every affected unit within four hours of a recall notice, which is impossible without lot data at receipt.', 'HL-I/REF'),
          rule('reject', 'Expiry date must be at least 12 months beyond the ship date unless the purchase order explicitly accepts short dating.',
            'Short dated stock expires on the shelf and is written off at full cost.', 'REF'),
          rule('reject', 'The ASN must be transmitted at despatch and before arrival at the service centre.',
            'Receiving opens on the ASN, and a trailer arriving first is held.', 'transmission'),
          rule('warn', 'One shipment identifier per trailer. Splitting a trailer across several ASNs produces duplicate receipts.',
            'The service centre receives by trailer.', 'BSN02')
        ],
        scenarios: [
          sc('Standard supply shipment', 'Non-dated supplies to the service centre.', 'The baseline.'),
          sc('Lot controlled shipment', 'Items with lot and expiry.', 'Lot and expiry at every item level.'),
          sc('Multiple lots of one item', 'One item shipped from two lots.', 'Separate item levels per lot, never combined.'),
          sc('Direct to facility delivery', 'Bypassing the service centre.', 'Facility code in N1*ST rather than the service centre code.')
        ]
      },
      '810': {
        summary: 'Pallas matches invoice to contract price, to purchase order and to receipt. A mismatch on any of the three holds payment.',
        elements: {
          'IT106': { values: [c('UK', 'GTIN-14'), c('UP', 'GTIN-12')] },
          'REF01': { values: [c('CT', 'Contract number'), c('SI', 'Shipment identifier')], note: 'Both are required: contract for price validation, shipment for receipt matching.' }
        },
        rules: [
          rule('reject', 'Invoice price must equal the contract price in force on the ship date, not the invoice date.',
            'Contract prices change on effective dates, and billing at the invoice date price overcharges on every shipment in transit across a change.', 'IT104'),
          rule('reject', 'Every invoice references the ASN shipment identifier in REF*SI.',
            'Pallas matches payable to receipt by shipment.', 'REF'),
          rule('warn', 'Freight charges are only payable where the contract specifies. Unsupported freight lines are deducted without query.',
            'Most Pallas contracts are delivered pricing.', 'SAC')
        ],
        scenarios: [
          sc('Contract price invoice', 'Standard supplies on contract.', 'The baseline.'),
          sc('Invoice across a price change', 'Shipped before, invoiced after a contract price change.', 'Price at the ship date.'),
          sc('Credit for a recalled lot', 'A credit against recalled product.', 'BIG07 = CR with the lot in REF.')
        ]
      },
      '846': {
        summary: 'Availability drives Pallas substitution decisions during shortages, which are routine in medical supply.',
        elements: {
          'QTY01': { values: [c('33', 'Available for sale'), c('20', 'On hand'), c('98', 'Allocated')] }
        },
        rules: [
          rule('reject', 'Report availability by GTIN. Supplier catalogue numbers alone cannot be matched to the Pallas item master.',
            'Availability that cannot be matched to an item is not usable in a shortage.', 'LIN'),
          rule('warn', 'Allocated quantity (QTY01 = 98) should be reported for items under allocation, so Pallas can plan rather than discover a shortage at order time.',
            'Allocation visibility is the difference between planning around a shortage and reacting to one.', 'QTY')
        ],
        scenarios: [
          sc('Daily availability file', 'All contracted items.', 'The baseline.'),
          sc('Item under allocation', 'A constrained product.', 'Report available and allocated separately.')
        ]
      },
      '997': {
        summary: 'Syntax acknowledgment within one hour. Business validation arrives separately as an 824.',
        rules: [
          rule('reject', 'Return a 997 within one hour.', 'Pallas escalates unacknowledged interchanges after one hour.', 'transmission'),
          rule('warn', 'An accepted 997 confirms syntax only. Pallas sends an 824 for business acceptance on 850, 856 and 810.',
            'Treating a 997 as business acceptance hides rejected documents until someone notices the goods never arrived.', 'AK501')
        ],
        scenarios: [
          sc('Standard acknowledgment', 'A received order.', 'AK901 = A within one hour.')
        ]
      }
    }
  },

  /* ================================================================ 6 */
  {
    slug: 'meridian-industrial',
    partnerTerm: 'supplier',
    name: 'Meridian Industrial Supply',
    legalName: 'Meridian Industrial Supply Co.',
    industry: 'Industrial distribution and MRO',
    about: 'A distributor of maintenance, repair and operations supplies serving manufacturing plants, with 2,800 suppliers and a large drop-ship programme.',
    attestor: { name: 'Russ Ekstrand', role: 'Director, Supplier Operations' },
    stdVersion: '004010',
    effectiveFrom: '2026-06-15',
    sourceDoc: 'Meridian Supplier EDI Requirements v5.3 (PDF, April 2026)',
    pages: 44,
    delimiters: { segment: '~', element: '*', component: '>', repetition: '^' },
    envelope: {
      qualifier: '01', receiverId: '556201349', appReceiverCode: 'MERIDIANIS',
      senderNote: 'DUNS. Drop-ship suppliers use the same DUNS as their stocking relationship.',
      ackRequested: '1',
      usageNote: 'T during certification. Meridian certifies stocking and drop-ship flows separately because the ship-to differs.'
    },
    commonRules: [
      rule('reject', 'Drop-ship transactions must carry the end customer in N1*ST and Meridian in N1*BY. Reversing these ships product to the wrong address.',
        'Roughly 40 percent of Meridian volume ships directly to the end customer, and the ship-to is not Meridian.', 'N1'),
      rule('info', 'Meridian returns a 997 within two hours and operates a nightly maintenance window from 02:00 to 03:00 Central.',
        'Transmissions during the window queue and process at 03:00.', 'transmission')
    ],
    contacts: [
      { role: 'Supplier operations', name: 'Meridian Supplier EDI', email: 'supplier-edi@meridianindustrial.example', note: '7am to 7pm Central.' },
      { role: 'Drop-ship programme', name: 'Meridian Direct Fulfilment', email: 'dropship@meridianindustrial.example', note: 'End customer address and delivery questions.' }
    ],
    sets: {
      '850': {
        summary: 'Meridian sends stocking orders to its own distribution centres and drop-ship orders direct to the end customer. The two look alike and must be handled differently.',
        elements: {
          'BEG02': { values: [c('SA', 'Stocking order to a Meridian DC'), c('DS', 'Drop ship to the end customer'), c('RL', 'Release against a blanket')] },
          'PO106': { values: [c('VP', "Supplier's part number"), c('BP', 'Meridian item number'), c('MG', "Manufacturer's part number")] },
          'N101': { values: [c('ST', 'Ship to'), c('BY', 'Buying party'), c('BT', 'Bill to')], note: 'On a drop ship, ST is the end customer and BT is Meridian.' }
        },
        rules: [
          rule('reject', 'A drop-ship order (BEG02 = DS) ships to the address in N1*ST, which is the end customer, and bills to Meridian.',
            'Shipping a drop ship to Meridian defeats the purpose and the freight is charged back.', 'BEG02'),
          rule('reject', 'Drop-ship packing slips must show Meridian as the shipper and must not include supplier pricing.',
            'The end customer is Meridian’s customer, and supplier pricing on the packing slip discloses margin.', 'packing documentation'),
          rule('warn', 'Blanket releases carry the blanket number in REF*BO. A release without it is treated as a new stand-alone order.',
            'Stand-alone treatment loses the blanket pricing.', 'REF')
        ],
        scenarios: [
          sc('Stocking order', 'Replenishment to a Meridian DC.', 'The baseline.'),
          sc('Drop ship to end customer', 'Direct shipment to a plant.', 'End customer in ST, Meridian in BT, no supplier pricing on paperwork.'),
          sc('Blanket release', 'A release against contracted pricing.', 'BEG02 = RL with the blanket in REF*BO.')
        ]
      },
      '855': {
        summary: 'Meridian quotes lead times to its customers from the acknowledgment, so an optimistic date here becomes a missed commitment downstream.',
        elements: {
          'ACK01': { values: [c('IA', 'Accepted'), c('IR', 'Rejected'), c('IQ', 'Quantity changed'), c('IB', 'Backordered'), c('DR', 'Date rescheduled'), c('IS', 'Substituted')] }
        },
        rules: [
          rule('reject', 'Acknowledge within 24 hours, or within four hours for drop-ship orders.',
            'Meridian confirms a delivery date to the end customer from this document, and the customer is waiting.', '855 response'),
          rule('reject', 'Every acknowledgment must carry a ship date, including backordered lines.',
            'Meridian cannot quote a date to its customer without one, and the order sits in an exception queue.', 'ACK05'),
          rule('warn', 'A substitution must be functionally equivalent and pre-approved on the Meridian cross-reference. Unapproved substitutes are returned at supplier cost.',
            'MRO substitutes affect equipment compatibility.', 'ACK01')
        ],
        scenarios: [
          sc('Stocking acknowledgment', 'Normal replenishment.', 'Inside 24 hours.'),
          sc('Drop-ship acknowledgment', 'Direct shipment order.', 'Inside four hours with a firm ship date.'),
          sc('Partial with backorder', 'Some quantity now, rest to follow.', 'IQ and IB with dates on both.')
        ]
      },
      '860': {
        summary: 'Meridian changes orders frequently because its customers do. A change must be applied as stated, not merged with what you already have.',
        elements: {
          'BCH01': { values: [c('01', 'Cancellation'), c('04', 'Change')] },
          'POC02': { values: [c('QI', 'Quantity increase'), c('QD', 'Quantity decrease'), c('CA', 'Line cancelled'), c('PC', 'Price change'), c('DI', 'Date change'), c('AI', 'Line added')] }
        },
        rules: [
          rule('reject', 'POC01 must reference the original line number from the 850. A change that cannot be matched to a line is rejected.',
            'Meridian tracks changes per line, and an unmatched change is ambiguous.', 'POC01'),
          rule('reject', 'Acknowledge a change with an 855 within four hours, stating whether the change can be met.',
            'A change Meridian cannot confirm is a commitment it cannot make to its customer.', '855 response'),
          rule('warn', 'A change received after shipment is void. Notify Meridian by telephone rather than processing it.',
            'Processing a post-shipment change produces a duplicate shipment.', 'timing')
        ],
        scenarios: [
          sc('Quantity increase', 'More of an existing line.', 'QI with the new total quantity, not the delta.'),
          sc('Line cancellation', 'One line removed, order otherwise intact.', 'CA on that line only.'),
          sc('Full cancellation', 'The whole order pulled.', 'BCH01 = 01.')
        ]
      },
      '856': {
        summary: 'Meridian receives stocking shipments at its DCs by carton. Drop shipments are never received by Meridian at all, but still require an ASN so the customer can be notified.',
        elements: {
          'BSN05': { values: [c('0001', 'Shipment, Order, Packaging, Item'), c('0004', 'Shipment, Order, Item')], note: '0001 for stocking shipments into a DC. 0004 is acceptable for drop ship, where Meridian never touches the goods.' },
          'MAN01': { values: [c('GM', 'SSCC-18'), c('CP', 'Carrier package identifier')], note: 'CP, a parcel tracking number, is acceptable on drop ship. Stocking shipments require GM.' }
        },
        rules: [
          rule('reject', 'Stocking shipments to a Meridian DC require hierarchy 0001 with one pack level per carton and an SSCC on each.',
            'DC receiving scans carton labels.', 'BSN05'),
          rule('reject', 'Drop-ship ASNs must carry the parcel tracking number in MAN or REF*CN.',
            'Meridian passes tracking to the end customer, and an ASN without it generates a service call.', 'MAN02'),
          rule('warn', 'Transmit the ASN the same day as despatch.',
            'Meridian notifies the end customer from the ASN, and a late ASN means the goods arrive before the notification.', 'transmission')
        ],
        scenarios: [
          sc('Stocking shipment to a DC', 'Cartons to a Meridian distribution centre.', 'Hierarchy 0001 with SSCC per carton.'),
          sc('Drop ship by parcel', 'Direct to the end customer.', 'Hierarchy 0004 with the tracking number.'),
          sc('Partial shipment of a backordered line', 'Part of a line ships now.', 'Ship what exists, reference the same PO line.')
        ]
      },
      '810': {
        summary: 'Meridian matches invoice to order and to receipt for stocking, and to order and proof of delivery for drop ship.',
        elements: {
          'IT106': { values: [c('VP', "Supplier's part number"), c('BP', 'Meridian item number')] }
        },
        rules: [
          rule('reject', 'Drop-ship invoices must reference the ASN tracking number, since Meridian has no receipt of its own.',
            'With no receipt, the tracking number is the only proof of delivery available for matching.', 'REF'),
          rule('reject', 'One invoice per shipment. Meridian does not accept monthly summary invoices.',
            'Meridian pays per shipment, matched to a receipt or a delivery.', 'BIG02'),
          rule('warn', 'Freight is payable only where the order states prepay and add. Unsupported freight is deducted.',
            'Most Meridian terms are delivered.', 'SAC')
        ],
        scenarios: [
          sc('Stocking invoice', 'Against a DC receipt.', 'The baseline.'),
          sc('Drop-ship invoice', 'Against a delivery to the end customer.', 'Tracking number in REF.')
        ]
      },
      '846': {
        summary: 'Meridian quotes availability to customers in real time from this feed, so accuracy here is directly visible to the end customer.',
        elements: {
          'QTY01': { values: [c('33', 'Available for sale'), c('99', 'Quantity on order'), c('20', 'On hand')] }
        },
        rules: [
          rule('reject', 'Availability must be reported at least daily for every item on the Meridian catalogue.',
            'Meridian publishes availability to customers, and a stale figure produces an order it cannot fill.', 'transmission'),
          rule('warn', 'Report quantity on order with an expected date where the item is out of stock.',
            'Customers accept a date; they do not accept an unexplained zero.', 'QTY')
        ],
        scenarios: [
          sc('Daily availability', 'All catalogue items.', 'The baseline.'),
          sc('Out of stock with replenishment', 'Zero available, inbound expected.', 'Available zero plus on order with a date.')
        ]
      },
      '997': {
        summary: 'Required within two hours in both directions.',
        rules: [
          rule('reject', 'Return a 997 within two hours.', 'Meridian escalates unacknowledged interchanges after two hours.', 'transmission')
        ],
        scenarios: [ sc('Standard acknowledgment', 'A received order.', 'AK901 = A within two hours.') ]
      }
    }
  },

  /* ================================================================ 7 */
  {
    slug: 'brightline-apparel',
    partnerTerm: 'vendor',
    name: 'Brightline Apparel',
    legalName: 'Brightline Apparel Group',
    industry: 'Apparel and footwear retail',
    about: 'A specialty apparel retailer with 620 stores and an e-commerce operation, buying from roughly 300 vendors, most of them importing.',
    attestor: { name: 'Celia Marchetti', role: 'Head of Vendor Compliance' },
    stdVersion: '004010',
    effectiveFrom: '2026-07-01',
    sourceDoc: 'Brightline Vendor Routing and EDI Manual, 2026 (PDF, May 2026)',
    pages: 58,
    delimiters: { segment: '~', element: '*', component: '>', repetition: '^' },
    envelope: {
      qualifier: '12', receiverId: '2125550180', appReceiverCode: 'BRIGHTLINE',
      senderNote: 'Brightline uses phone-number qualifier 12 for historical reasons. Your assigned ID is on your vendor setup sheet, not your DUNS.',
      ackRequested: '1',
      usageNote: 'T during testing. Brightline requires a successful parallel of all five transaction sets before any goes to production.'
    },
    commonRules: [
      rule('reject', 'Every style must be identified by the Brightline style, colour and size combination. A style number alone is not sufficient on any transaction.',
        'Apparel is bought and sold at the size and colour level, and a style-level transaction cannot be allocated to a store.', 'item identification'),
      rule('warn', 'Vendor compliance chargebacks are applied monthly against the standards in the routing manual, not against this guide alone.',
        'The routing manual covers physical packing and labelling, which EDI cannot express.', 'compliance'),
      rule('info', 'Brightline returns a 997 within four hours. The EDI interface is unavailable Sunday 02:00 to 06:00 Eastern for maintenance.',
        'The weekly window is used for item master and allocation processing.', 'transmission')
    ],
    contacts: [
      { role: 'Vendor compliance', name: 'Brightline Vendor Compliance', email: 'vendorcompliance@brightlineapparel.example', note: 'Chargeback disputes and routing questions.' },
      { role: 'EDI support', name: 'Brightline EDI', email: 'edi@brightlineapparel.example', note: '9am to 6pm Eastern, Monday to Friday.' }
    ],
    sets: {
      '850': {
        summary: 'A Brightline order is a style broken into a size and colour matrix. The matrix, not the style, is what gets allocated, shipped and sold.',
        elements: {
          'PO106': { values: [c('UP', 'GTIN-12 for the size and colour'), c('VA', 'Vendor style number'), c('IZ', 'Buyer size code'), c('BO', 'Buyer colour code')], note: 'All four identifiers are sent on every line.' },
          'BEG02': { values: [c('SA', 'Stand-alone'), c('NE', 'New order'), c('RL', 'Release')] },
          'DTM01': { values: [c('037', 'Ship not before'), c('038', 'Ship no later than'), c('002', 'Requested delivery')], note: 'The 037 and 038 pair is the ship window. Shipping outside it is a chargeback.' }
        },
        rules: [
          rule('reject', 'Each size and colour combination is a separate PO1 line with its own GTIN. A single line for a whole style is rejected.',
            'Brightline allocates to stores by size curve, which is impossible from a style-level order.', 'PO1'),
          rule('reject', 'Shipping before the ship-not-before date (DTM*037) is a compliance violation and the goods may be refused.',
            'Early receipt occupies DC space allocated to another vendor and disrupts the floor-set calendar.', 'DTM'),
          rule('warn', 'Prepack and assortment orders carry the pack configuration in PO4. Breaking a prepack is a chargeback.',
            'Prepacks are built to a store size curve and are shipped to the floor unopened.', 'PO4')
        ],
        scenarios: [
          sc('Single style size matrix', 'One style, six sizes, two colours.', 'Twelve lines, each with its own GTIN.'),
          sc('Prepack order', 'An assortment pack built to a size curve.', 'Pack configuration in PO4, shipped unopened.'),
          sc('E-commerce order', 'Direct to the e-commerce fulfilment centre.', 'Different ship-to, no store allocation.')
        ]
      },
      '860': {
        summary: 'Apparel orders change constantly ahead of a floor set. Brightline sends changes right up to the ship window.',
        elements: {
          'POC02': { values: [c('QI', 'Quantity increase'), c('QD', 'Quantity decrease'), c('CA', 'Cancel line'), c('DI', 'Date change'), c('PC', 'Price change')] }
        },
        rules: [
          rule('reject', 'Quantity on a change is the new total for that size and colour, not an adjustment.',
            'Treating it as a delta double counts the change, which is the most common error on this document.', 'POC03'),
          rule('reject', 'Acknowledge a change with an 855 within 24 hours.',
            'Brightline must know before the floor-set deadline whether the change can be met.', '855 response'),
          rule('warn', 'Changes inside the ship window are advisory. If goods are already packed, notify the buyer rather than repacking.',
            'Repacking inside the window usually misses the window, which is worse than the original quantity.', 'timing')
        ],
        scenarios: [
          sc('Size curve adjustment', 'Quantities moved between sizes.', 'New totals per size, not deltas.'),
          sc('Colour cancellation', 'One colourway dropped.', 'CA on every line for that colour.')
        ]
      },
      '856': {
        summary: 'Brightline receives by carton and cross-docks to stores. The carton is the unit of allocation, so the pack level has to reflect exactly what is in each box.',
        elements: {
          'BSN05': { values: [c('0001', 'Shipment, Order, Packaging, Item')], note: '0001 only. Brightline cross-docks by carton and cannot receive without a pack level.' },
          'MAN01': { values: [c('GM', 'SSCC-18')], note: 'The GS1-128 carton label applied per the routing manual.' },
          'LIN02': { values: [c('UP', 'GTIN-12')], note: 'At the size and colour level, matching the order line.' }
        },
        rules: [
          rule('reject', 'Carton contents in the ASN must match the physical carton exactly. A content mismatch found at audit is charged back per carton.',
            'Brightline cross-docks cartons to stores without opening them, so a wrong carton reaches a store and the error is discovered at retail.', 'HL-P'),
          rule('reject', 'One SSCC per carton, unique for 24 months, matching the GS1-128 label.',
            'The label is scanned at the cross-dock and again at the store.', 'MAN02'),
          rule('reject', 'Store-ready cartons must carry the destination store number in the pack level REF.',
            'A carton with no store cannot be cross-docked and is diverted to manual sortation.', 'HL-P/REF'),
          rule('warn', 'Transmit the ASN at least 24 hours before arrival for import shipments, and at despatch for domestic.',
            'Import containers are scheduled against a deconsolidation plan built from the ASN.', 'transmission')
        ],
        scenarios: [
          sc('Bulk carton shipment', 'Cartons of one style and size to the DC for allocation.', 'The baseline.'),
          sc('Store-ready prepack', 'Cartons pre-allocated to named stores.', 'Store number in the pack level REF.'),
          sc('Import container', 'A full container from an overseas vendor.', 'ASN 24 hours ahead with container number in TD3.'),
          sc('Mixed carton', 'Several sizes of one style in one carton.', 'One pack level, an item level per size.')
        ]
      },
      '810': {
        summary: 'Brightline matches invoices to the order at size and colour level and deducts compliance chargebacks at payment.',
        elements: {
          'IT106': { values: [c('UP', 'GTIN-12'), c('VA', 'Vendor style')] }
        },
        rules: [
          rule('reject', 'Invoice at the same size and colour granularity as the order. A style-level invoice cannot be matched.',
            'Brightline reconciles payable per GTIN, since that is how the order and receipt are recorded.', 'IT1'),
          rule('warn', 'Compliance chargebacks are deducted at payment and detailed on the remittance. Disputes go to vendor compliance, not to accounts payable.',
            'Accounts payable has no authority over compliance deductions and the dispute is simply forwarded.', 'deductions')
        ],
        scenarios: [
          sc('Standard invoice', 'One PO, one shipment.', 'The baseline.'),
          sc('Invoice for an import shipment', 'Goods on delivered duty paid terms.', 'No separate freight or duty lines.')
        ]
      },
      '852': {
        summary: 'Brightline shares weekly selling by style, colour and size so vendors can plan replenishment on core items.',
        elements: {
          'ZA01': { values: [c('QS', 'Quantity sold'), c('QO', 'On hand'), c('QR', 'Received')] }
        },
        rules: [
          rule('info', 'Sent Monday covering the prior retail week, Sunday to Saturday.',
            'Aligned to the retail calendar rather than the calendar week.', 'transmission'),
          rule('info', 'Only core replenishment styles are included. Fashion styles are not reported.',
            'Fashion styles are bought once and not replenished, so movement data has no planning value.', 'scope')
        ],
        scenarios: [
          sc('Weekly selling file', 'Core styles by size and colour.', 'Consume at GTIN level.')
        ]
      },
      '997': {
        summary: 'Required within four hours in both directions.',
        rules: [
          rule('reject', 'Return a 997 within four hours.', 'Brightline escalates unacknowledged interchanges to vendor compliance.', 'transmission')
        ],
        scenarios: [ sc('Standard acknowledgment', 'A received order.', 'AK901 = A within four hours.') ]
      }
    }
  },

  /* ================================================================ 8 */
  {
    slug: 'cobalt-energy',
    partnerTerm: 'supplier',
    name: 'Cobalt Energy Services',
    legalName: 'Cobalt Energy Services LP',
    industry: 'Energy and field services',
    about: 'An oilfield and midstream services operator buying equipment, consumables and contracted field labour across four basins.',
    attestor: { name: 'Wes Darnell', role: 'Manager, Supply Chain Systems' },
    stdVersion: '005010',
    effectiveFrom: '2026-08-01',
    sourceDoc: 'Cobalt Energy Supplier EDI and Invoicing Standard v3 (PDF, June 2026)',
    pages: 39,
    delimiters: { segment: '~', element: '*', component: '>', repetition: '^' },
    envelope: {
      qualifier: '01', receiverId: '829330154', appReceiverCode: 'COBALTES',
      senderNote: 'DUNS at the legal entity that holds the master service agreement.',
      ackRequested: '1',
      usageNote: 'T until Cobalt confirms production per transaction set.'
    },
    commonRules: [
      rule('reject', 'Every transaction must carry the authorisation for expenditure number in REF*AH and the cost centre in REF*CC.',
        'Cobalt allocates all spend to a well or facility, and a transaction with no AFE cannot be coded or approved.', 'cost allocation'),
      rule('info', 'Cobalt returns a 997 within four hours, and an 824 on invoices that fail business validation.',
        'Invoice validation runs against the field ticket and the AFE, and takes longer than syntax checking.', 'transmission')
    ],
    contacts: [
      { role: 'Supply chain systems', name: 'Cobalt EDI Support', email: 'edi@cobaltenergy.example', note: '7am to 6pm Central, Monday to Friday.' },
      { role: 'Accounts payable', name: 'Cobalt AP Shared Services', email: 'ap@cobaltenergy.example', note: 'Invoice status and payment enquiries.' }
    ],
    sets: {
      '850': {
        summary: 'Cobalt orders both materials and contracted services. A services order has no quantity in the normal sense, and most integration failures start there.',
        elements: {
          'BEG02': { values: [c('SA', 'Stand-alone material order'), c('SS', 'Service order'), c('BK', 'Blanket order')] },
          'REF01': { values: [c('AH', 'Authorisation for expenditure (AFE)'), c('CC', 'Cost centre'), c('WO', 'Work order'), c('PK', 'Well or pad identifier')], note: 'AFE and cost centre are required on every order.' },
          'PO103': { values: [c('EA', 'Each'), c('DA', 'Days'), c('HR', 'Hours'), c('FT', 'Feet'), c('MO', 'Months')], note: 'Service orders are commonly in days or hours.' }
        },
        rules: [
          rule('reject', 'Every order carries an AFE in REF*AH and a cost centre in REF*CC.',
            'Cobalt capitalises spend against a well or facility, and an order without an AFE cannot be approved or paid.', 'REF'),
          rule('reject', 'Service orders (BEG02 = SS) must be invoiced against a field ticket, not against a delivery.',
            'There is no receipt for a service, so the field ticket is the only evidence of performance.', 'BEG02'),
          rule('warn', 'Well or pad identifier in REF*PK is required for field-delivered material.',
            'Without it the delivery cannot be routed to the right location, and locations are remote.', 'REF')
        ],
        scenarios: [
          sc('Material order to a yard', 'Consumables to a Cobalt yard.', 'The baseline.'),
          sc('Service order', 'Contracted field labour for a well.', 'BEG02 = SS with AFE, cost centre and well identifier.'),
          sc('Field delivery', 'Material direct to a pad.', 'Well identifier in REF*PK and pad coordinates in N3 and N4.')
        ]
      },
      '856': {
        summary: 'Field deliveries go to remote locations with no formal receiving dock, so the ASN is often the only record that material arrived.',
        elements: {
          'BSN05': { values: [c('0004', 'Shipment, Order, Item'), c('0001', 'Shipment, Order, Packaging, Item')], note: '0004 is sufficient for field delivery. Yard deliveries use 0001.' },
          'REF01': { values: [c('AH', 'AFE'), c('PK', 'Well or pad identifier'), c('BM', 'Bill of lading')] }
        },
        rules: [
          rule('reject', 'Field deliveries must carry the well or pad identifier in REF*PK at shipment level.',
            'There is no dock and no receiving clerk at a pad, so the identifier is the only thing tying the delivery to a location.', 'HL-S/REF'),
          rule('reject', 'Transmit the ASN before the vehicle leaves your yard.',
            'Field locations have limited connectivity, and the ASN is used to confirm the delivery against the daily plan.', 'transmission'),
          rule('warn', 'Yard deliveries follow standard carton receiving with hierarchy 0001.',
            'Yards have conventional receiving and scan carton labels.', 'BSN05')
        ],
        scenarios: [
          sc('Yard delivery', 'Material to a Cobalt yard.', 'Hierarchy 0001 with carton labels.'),
          sc('Field delivery to a pad', 'Material direct to a well site.', 'Hierarchy 0004 with the well identifier.')
        ]
      },
      '810': {
        summary: 'Cobalt validates every invoice against the AFE, the cost centre and either a receipt or a signed field ticket. An invoice missing any of the three cannot be coded.',
        elements: {
          'REF01': { values: [c('AH', 'AFE'), c('CC', 'Cost centre'), c('FT', 'Field ticket number'), c('WO', 'Work order')], note: 'AFE and cost centre always. Field ticket for services, work order where one was issued.' },
          'TXI01': { values: [c('ST', 'State sales tax'), c('CT', 'County or local tax'), c('LS', 'State and local combined')], note: 'Cobalt operates across several tax jurisdictions and reconciles tax separately.' }
        },
        rules: [
          rule('reject', 'Service invoices must reference a signed field ticket number in REF*FT.',
            'With no receipt against a service, the field ticket is the only proof of performance and Cobalt cannot approve payment without it.', 'REF'),
          rule('reject', 'Tax must be stated separately in TXI by jurisdiction. Tax folded into the unit price is rejected.',
            'Cobalt recovers tax by jurisdiction and cannot do so from a tax-inclusive price.', 'TXI'),
          rule('reject', 'The AFE on the invoice must match the AFE on the purchase order.',
            'Invoices are coded to the AFE at approval, and a mismatch routes the invoice to a manual exception queue.', 'REF'),
          rule('warn', 'Invoices submitted more than 60 days after the service date fall outside the accrual window and require management approval.',
            'Late invoices distort well cost reporting after the books close.', 'BIG01')
        ],
        scenarios: [
          sc('Material invoice', 'Against a delivered material order.', 'AFE, cost centre, receipt.'),
          sc('Service invoice', 'Against contracted field labour.', 'Field ticket number required.'),
          sc('Multi-jurisdiction tax', 'Work spanning two counties.', 'Separate TXI per jurisdiction.')
        ]
      },
      '820': {
        summary: 'Cobalt sends remittance advice with every payment run, including the AFE coding applied to each invoice.',
        elements: {
          'BPR01': { values: [c('I', 'Remittance information only')] },
          'RMR01': { values: [c('IV', 'Invoice number')] }
        },
        rules: [
          rule('info', 'Payment runs are weekly on Thursday. Remittance is transmitted the same day.',
            'Weekly cadence aligns with the approval cycle.', 'transmission'),
          rule('info', 'Deductions carry an ADX with a reason code. The most common is a tax adjustment where the jurisdiction was coded incorrectly.',
            'Tax coding errors are the most frequent cause of a short payment at Cobalt.', 'ADX')
        ],
        scenarios: [
          sc('Weekly remittance', 'One payment covering several invoices.', 'One RMR per invoice.'),
          sc('Payment with a tax adjustment', 'Tax corrected at approval.', 'ADX with the reason code.')
        ]
      },
      '824': {
        summary: 'Cobalt reports invoice business validation failures here, which is how a supplier learns an invoice will not be paid before the payment run.',
        elements: {
          'OTI01': { values: [c('TA', 'Accepted'), c('TR', 'Rejected'), c('TE', 'Accepted with errors')] },
          'TED01': { values: [c('024', 'Invalid AFE'), c('800', 'No matching field ticket'), c('801', 'Price variance'), c('802', 'Tax jurisdiction mismatch')] }
        },
        rules: [
          rule('reject', 'An 824 with TR means the invoice was not entered. Correct and resubmit as a new invoice number.',
            'Resubmitting the same invoice number against a rejected invoice creates a duplicate that is rejected again.', 'OTI01'),
          rule('warn', 'An 824 arrives within one business day of the invoice. No 824 means the invoice passed validation.',
            'Silence is acceptance on this document, which is the opposite of the 997 convention.', 'timing')
        ],
        scenarios: [
          sc('Invoice rejected for a bad AFE', 'AFE closed or mistyped.', 'TR with TED 024.'),
          sc('Invoice rejected for a missing field ticket', 'Service invoice with no matching ticket.', 'TR with TED 800.')
        ]
      },
      '997': {
        summary: 'Required within four hours in both directions.',
        rules: [
          rule('reject', 'Return a 997 within four hours.', 'Cobalt escalates unacknowledged interchanges to the supplier contact.', 'transmission')
        ],
        scenarios: [ sc('Standard acknowledgment', 'A received order.', 'AK901 = A within four hours.') ]
      }
    }
  }
];
