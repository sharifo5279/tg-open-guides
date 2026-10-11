/**
 * Transaction set structures.
 *
 * Each entry is the ordered skeleton of one X12 transaction set: which segments
 * appear, in which area, inside which loop, with the standard's own usage and
 * max use. A hub profile then overrides usage, restricts code lists and adds
 * notes and rules on top of this.
 *
 * `key` points at the segment dictionary; `id` is derived from it, so a segment
 * reused under a different name (LIN in a schedule) still renders as LIN.
 */

const s = (key, pos, level, usage, maxUse, loopId = null) => ({ key, pos, level, usage, maxUse, loopId });

export const LOOP_META = {
  'N1':      { name: 'Name and address',    repeat: 200 },
  'PO1':     { name: 'Line item',           repeat: 100000 },
  'IT1':     { name: 'Invoice line item',   repeat: 200000 },
  'HL-S':    { name: 'Shipment level',      repeat: 1 },
  'HL-S/N1': { name: 'Shipment names',      repeat: 200 },
  'HL-O':    { name: 'Order level',         repeat: 200000 },
  'HL-P':    { name: 'Pack level',          repeat: 200000 },
  'HL-I':    { name: 'Item level',          repeat: 200000 },
  'ACK':     { name: 'Acknowledged line',   repeat: 100000 },
  'POC':     { name: 'Changed line',        repeat: 100000 },
  'LIN':     { name: 'Item schedule',       repeat: 10000 },
  'FST':     { name: 'Forecast bucket',     repeat: 100000 },
  'LIN-INV': { name: 'Inventory item',      repeat: 10000 },
  'ZA':      { name: 'Activity',            repeat: 10000 },
  'AK2':     { name: 'Transaction response', repeat: 999999 },
  'AK3':     { name: 'Segment note',        repeat: 999999 },
  'RMR':     { name: 'Remittance item',     repeat: 10000 },
  'OTI':     { name: 'Original transaction', repeat: 10000 },
  'S5':      { name: 'Stop',                repeat: 999 },
  'S5/OID':  { name: 'Stop order detail',   repeat: 1000 },
  'LX':      { name: 'Assigned number',     repeat: 9999 },
  'W12':     { name: 'Shipped line',        repeat: 9999 },
  'W01':     { name: 'Ordered line',        repeat: 9999 },
  'AT7':     { name: 'Status event',        repeat: 100 }
};

export const TRANSACTIONS = {
  '850': {
    name: 'Purchase Order',
    title: 'Purchase Order (850)',
    direction: 'partner_receives',
    functionalId: 'PO',
    purpose: 'orders the hub places with its suppliers',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BEG', '0200', 'header', 'required', 1),
      s('CUR', '0400', 'header', 'optional', 1),
      s('REF', '0500', 'header', 'optional', 12),
      s('FOB', '0600', 'header', 'optional', 1),
      s('ITD', '1300', 'header', 'optional', 5),
      s('DTM', '1500', 'header', 'required', 10),
      s('TD5', '2400', 'header', 'optional', 12),
      s('N1',  '3100', 'header', 'required', 1, 'N1'),
      s('N3',  '3300', 'header', 'optional', 2, 'N1'),
      s('N4',  '3400', 'header', 'optional', 1, 'N1'),
      s('PO1', '0100', 'detail', 'required', 1, 'PO1'),
      s('PID', '0500', 'detail', 'optional', 200, 'PO1'),
      s('PO4', '0900', 'detail', 'optional', 1, 'PO1'),
      s('SAC', '1300', 'detail', 'optional', 25, 'PO1'),
      s('DTM', '2100', 'detail', 'optional', 10, 'PO1'),
      s('CTT', '0100', 'summary', 'required', 1),
      s('SE',  '0300', 'summary', 'required', 1)
    ]
  },

  '855': {
    name: 'Purchase Order Acknowledgment',
    title: 'Purchase Order Acknowledgment (855)',
    direction: 'partner_sends',
    functionalId: 'PR',
    purpose: 'confirms what the supplier will actually ship against an order',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BAK', '0200', 'header', 'required', 1),
      s('REF', '0500', 'header', 'optional', 12),
      s('DTM', '1500', 'header', 'optional', 10),
      s('N1',  '3100', 'header', 'optional', 1, 'N1'),
      s('PO1', '0100', 'detail', 'required', 1, 'PO1'),
      s('ACK', '0270', 'detail', 'required', 104, 'ACK'),
      s('DTM', '0300', 'detail', 'optional', 10, 'ACK'),
      s('CTT', '0100', 'summary', 'required', 1),
      s('SE',  '0300', 'summary', 'required', 1)
    ]
  },

  '860': {
    name: 'Purchase Order Change Request',
    title: 'Purchase Order Change (860)',
    direction: 'partner_receives',
    functionalId: 'PC',
    purpose: 'changes or cancels an order the hub already placed',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BCH', '0200', 'header', 'required', 1),
      s('REF', '0500', 'header', 'optional', 12),
      s('DTM', '1500', 'header', 'optional', 10),
      s('N1',  '3100', 'header', 'optional', 1, 'N1'),
      s('POC', '0100', 'detail', 'required', 1, 'POC'),
      s('PID', '0200', 'detail', 'optional', 200, 'POC'),
      s('DTM', '0600', 'detail', 'optional', 10, 'POC'),
      s('CTT', '0100', 'summary', 'required', 1),
      s('SE',  '0300', 'summary', 'required', 1)
    ]
  },

  '856': {
    name: 'Ship Notice/Manifest',
    title: 'Advance Ship Notice (856)',
    direction: 'partner_sends',
    functionalId: 'SH',
    purpose: 'tells the hub what is on the truck before it arrives',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BSN', '0200', 'header', 'required', 1),
      s('DTM', '0300', 'header', 'required', 2),
      s('HL',  '0100', 'detail', 'required', 1, 'HL-S'),
      s('TD1', '1100', 'detail', 'required', 20, 'HL-S'),
      s('TD5', '1200', 'detail', 'required', 12, 'HL-S'),
      s('TD3', '1300', 'detail', 'conditional', 12, 'HL-S'),
      s('REF', '1500', 'detail', 'required', 200, 'HL-S'),
      s('FOB', '2200', 'detail', 'optional', 1, 'HL-S'),
      s('N1',  '3100', 'detail', 'required', 2, 'HL-S/N1'),
      s('N3',  '3300', 'detail', 'optional', 2, 'HL-S/N1'),
      s('N4',  '3400', 'detail', 'optional', 1, 'HL-S/N1'),
      s('HL',  '0100', 'detail', 'required', 1, 'HL-O'),
      s('PRF', '0500', 'detail', 'required', 1, 'HL-O'),
      s('REF', '1500', 'detail', 'optional', 200, 'HL-O'),
      s('HL',  '0100', 'detail', 'required', 1, 'HL-P'),
      s('MAN', '2900', 'detail', 'required', 10, 'HL-P'),
      s('PO4', '0600', 'detail', 'optional', 1, 'HL-P'),
      s('HL',  '0100', 'detail', 'required', 1, 'HL-I'),
      s('LIN', '0200', 'detail', 'required', 1, 'HL-I'),
      s('SN1', '0300', 'detail', 'required', 1, 'HL-I'),
      s('CTT', '0100', 'summary', 'required', 1),
      s('SE',  '0200', 'summary', 'required', 1)
    ]
  },

  '810': {
    name: 'Invoice',
    title: 'Invoice (810)',
    direction: 'partner_sends',
    functionalId: 'IN',
    purpose: 'bills the hub for goods or services delivered',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BIG', '0200', 'header', 'required', 1),
      s('CUR', '0400', 'header', 'optional', 1),
      s('REF', '0500', 'header', 'optional', 12),
      s('N1',  '0700', 'header', 'required', 1, 'N1'),
      s('N3',  '0900', 'header', 'optional', 2, 'N1'),
      s('N4',  '1000', 'header', 'optional', 1, 'N1'),
      s('ITD', '1300', 'header', 'optional', 5),
      s('DTM', '1400', 'header', 'optional', 10),
      s('IT1', '0100', 'detail', 'required', 1, 'IT1'),
      s('PID', '0600', 'detail', 'optional', 200, 'IT1'),
      s('REF', '1200', 'detail', 'optional', 200, 'IT1'),
      s('SAC', '1800', 'detail', 'optional', 25, 'IT1'),
      s('TDS', '0100', 'summary', 'required', 1),
      s('TXI', '0200', 'summary', 'optional', 10),
      s('SAC', '0300', 'summary', 'optional', 25),
      s('CTT', '0400', 'summary', 'required', 1),
      s('SE',  '0500', 'summary', 'required', 1)
    ]
  },

  '820': {
    name: 'Payment Order/Remittance Advice',
    title: 'Remittance Advice (820)',
    direction: 'partner_receives',
    functionalId: 'RA',
    purpose: 'tells the supplier which invoices a payment covers',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BPR', '0200', 'header', 'required', 1),
      s('TRN', '0350', 'header', 'required', 1),
      s('REF', '0500', 'header', 'optional', 12),
      s('DTM', '0700', 'header', 'optional', 10),
      s('N1',  '0100', 'detail', 'required', 1, 'N1'),
      s('RMR', '0100', 'detail', 'required', 1, 'RMR'),
      s('REF', '0200', 'detail', 'optional', 30, 'RMR'),
      s('DTM', '0400', 'detail', 'optional', 10, 'RMR'),
      s('ADX', '0500', 'detail', 'optional', 1, 'RMR'),
      s('SE',  '0100', 'summary', 'required', 1)
    ]
  },

  '824': {
    name: 'Application Advice',
    title: 'Application Advice (824)',
    // The hub validates what it received and reports back, so this arrives at
    // the partner. Marking it partner_sends put it on the wrong side of every
    // flow and told a supplier to build a document they only ever parse.
    direction: 'partner_receives',
    functionalId: 'AG',
    purpose: 'reports whether a received transaction passed the hub’s business validation',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BGN', '0200', 'header', 'required', 1),
      s('N1',  '0100', 'detail', 'optional', 1, 'N1'),
      s('OTI', '0100', 'detail', 'required', 1, 'OTI'),
      s('REF', '0200', 'detail', 'optional', 12, 'OTI'),
      s('DTM', '0300', 'detail', 'optional', 10, 'OTI'),
      s('TED', '0100', 'detail', 'optional', 100, 'OTI'),
      s('SE',  '0100', 'summary', 'required', 1)
    ]
  },

  '830': {
    name: 'Planning Schedule with Release Capability',
    title: 'Planning Schedule (830)',
    direction: 'partner_receives',
    functionalId: 'PS',
    purpose: 'gives the supplier firm and forecast requirements over a horizon',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BFR', '0200', 'header', 'required', 1),
      s('N1',  '0100', 'header', 'required', 1, 'N1'),
      s('LIN_SCHED', '0100', 'detail', 'required', 1, 'LIN'),
      s('UIT', '0200', 'detail', 'required', 1, 'LIN'),
      s('PID', '0400', 'detail', 'optional', 200, 'LIN'),
      s('REF', '1000', 'detail', 'optional', 12, 'LIN'),
      s('SHP', '2900', 'detail', 'required', 25, 'LIN'),
      s('FST', '0100', 'detail', 'required', 1, 'FST'),
      s('CTT', '0100', 'summary', 'required', 1),
      s('SE',  '0200', 'summary', 'required', 1)
    ]
  },

  '862': {
    name: 'Shipping Schedule',
    title: 'Shipping Schedule (862)',
    direction: 'partner_receives',
    functionalId: 'SS',
    purpose: 'issues firm ship authorisation inside the planning horizon',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BSS', '0200', 'header', 'required', 1),
      s('N1',  '0100', 'header', 'required', 1, 'N1'),
      s('LIN_SCHED', '0100', 'detail', 'required', 1, 'LIN'),
      s('UIT', '0200', 'detail', 'optional', 1, 'LIN'),
      s('REF', '0500', 'detail', 'optional', 12, 'LIN'),
      s('SHP', '1200', 'detail', 'required', 25, 'LIN'),
      s('FST', '0100', 'detail', 'required', 1, 'FST'),
      s('CTT', '0100', 'summary', 'required', 1),
      s('SE',  '0200', 'summary', 'required', 1)
    ]
  },

  '846': {
    name: 'Inventory Inquiry/Advice',
    title: 'Inventory Advice (846)',
    direction: 'partner_sends',
    functionalId: 'IB',
    purpose: 'reports available inventory so the hub can plan replenishment',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('BIA', '0200', 'header', 'required', 1),
      s('DTM', '0600', 'header', 'optional', 10),
      s('N1',  '0100', 'header', 'required', 1, 'N1'),
      s('LIN', '0100', 'detail', 'required', 1, 'LIN-INV'),
      s('PID', '0300', 'detail', 'optional', 200, 'LIN-INV'),
      s('QTY', '0500', 'detail', 'required', 100, 'LIN-INV'),
      s('DTM', '0700', 'detail', 'optional', 10, 'LIN-INV'),
      s('CTT', '0100', 'summary', 'required', 1),
      s('SE',  '0200', 'summary', 'required', 1)
    ]
  },

  '852': {
    name: 'Product Activity Data',
    title: 'Product Activity Data (852)',
    direction: 'partner_receives',
    functionalId: 'PD',
    purpose: 'shares sales and on-hand movement so suppliers can plan',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('XQ',  '0200', 'header', 'required', 1),
      s('N1',  '0100', 'header', 'required', 1, 'N1'),
      s('LIN', '0100', 'detail', 'required', 1, 'ZA'),
      s('XPO', '0200', 'detail', 'required', 100, 'ZA'),
      s('SE',  '0100', 'summary', 'required', 1)
    ]
  },

  '997': {
    name: 'Functional Acknowledgment',
    title: 'Functional Acknowledgment (997)',
    direction: 'partner_sends',
    functionalId: 'FA',
    purpose: 'confirms a transmission arrived and parsed',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('AK1', '0200', 'header', 'required', 1),
      s('AK2', '0100', 'detail', 'optional', 1, 'AK2'),
      s('AK3', '0100', 'detail', 'optional', 1, 'AK3'),
      s('AK5', '0400', 'detail', 'required', 1, 'AK2'),
      s('AK9', '0100', 'summary', 'required', 1),
      s('SE',  '0200', 'summary', 'required', 1)
    ]
  },

  '204': {
    name: 'Motor Carrier Load Tender',
    title: 'Motor Carrier Load Tender (204)',
    direction: 'partner_receives',
    functionalId: 'SM',
    purpose: 'offers a load to a carrier',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('B2',  '0200', 'header', 'required', 1),
      s('B2A', '0300', 'header', 'required', 1),
      s('L11', '0600', 'header', 'optional', 300),
      s('G62', '0800', 'header', 'optional', 1),
      s('N1',  '0100', 'header', 'optional', 1, 'N1'),
      s('S5',  '0100', 'detail', 'required', 1, 'S5'),
      s('L11', '0200', 'detail', 'optional', 50, 'S5'),
      s('G62', '0300', 'detail', 'required', 10, 'S5'),
      s('N1',  '0600', 'detail', 'required', 1, 'S5'),
      s('N3',  '0800', 'detail', 'optional', 2, 'S5'),
      s('N4',  '0900', 'detail', 'required', 1, 'S5'),
      s('OID', '0100', 'detail', 'optional', 1, 'S5/OID'),
      s('SE',  '0100', 'summary', 'required', 1)
    ]
  },

  '214': {
    name: 'Transportation Carrier Shipment Status Message',
    title: 'Shipment Status (214)',
    direction: 'partner_sends',
    functionalId: 'QM',
    purpose: 'reports where a shipment is and what happened to it',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('B10', '0200', 'header', 'required', 1),
      s('L11', '0300', 'header', 'optional', 300),
      s('N1',  '0100', 'detail', 'optional', 1, 'N1'),
      s('LX',  '0100', 'detail', 'required', 1, 'LX'),
      s('AT7', '0200', 'detail', 'required', 10, 'AT7'),
      s('MS1', '0300', 'detail', 'required', 1, 'AT7'),
      s('L11', '0400', 'detail', 'optional', 10, 'AT7'),
      s('SE',  '0100', 'summary', 'required', 1)
    ]
  },

  '990': {
    name: 'Response to a Load Tender',
    title: 'Response to a Load Tender (990)',
    direction: 'partner_sends',
    functionalId: 'GF',
    purpose: 'accepts or declines a tendered load',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('B1',  '0200', 'header', 'required', 1),
      s('L11', '0400', 'header', 'optional', 10),
      s('SE',  '0100', 'summary', 'required', 1)
    ]
  },

  '940': {
    name: 'Warehouse Shipping Order',
    title: 'Warehouse Shipping Order (940)',
    direction: 'partner_receives',
    functionalId: 'OW',
    purpose: 'instructs a warehouse to pick and ship',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('W05', '0200', 'header', 'required', 1),
      s('N1',  '0100', 'header', 'required', 1, 'N1'),
      s('N3',  '0300', 'header', 'optional', 2, 'N1'),
      s('N4',  '0400', 'header', 'required', 1, 'N1'),
      s('G62', '0700', 'header', 'optional', 10),
      s('TD5', '1200', 'header', 'optional', 12),
      s('LX',  '0100', 'detail', 'required', 1, 'LX'),
      s('W01', '0200', 'detail', 'required', 1, 'LX'),
      s('SE',  '0200', 'summary', 'required', 1)
    ]
  },

  '945': {
    name: 'Warehouse Shipping Advice',
    title: 'Warehouse Shipping Advice (945)',
    direction: 'partner_sends',
    functionalId: 'SW',
    purpose: 'reports what the warehouse actually shipped',
    segments: [
      s('ST',  '0100', 'header', 'required', 1),
      s('W06', '0200', 'header', 'required', 1),
      s('N1',  '0100', 'header', 'required', 1, 'N1'),
      s('G62', '0600', 'header', 'optional', 10),
      s('TD5', '1000', 'header', 'optional', 12),
      s('LX',  '0100', 'detail', 'required', 1, 'LX'),
      s('W12', '0200', 'detail', 'required', 1, 'LX'),
      s('MAN', '1200', 'detail', 'optional', 30, 'LX'),
      s('W03', '0100', 'summary', 'required', 1),
      s('SE',  '0200', 'summary', 'required', 1)
    ]
  }
};

/* 990 reuses B1, which is small enough to define alongside its only user. */
export const EXTRA_SEGMENTS = {
  B1: {
    name: 'Beginning Segment for Booking or Pick-up/Delivery',
    elements: [
      { ref: 'B101', id: '140', name: 'Standard Carrier Alpha Code', type: 'ID', min: 2, max: 4, usage: 'required', values: null, note: null },
      { ref: 'B102', id: '145', name: 'Shipment Identification Number', type: 'AN', min: 1, max: 30, usage: 'required', values: null, note: 'The shipment identifier from the 204 being answered.' },
      { ref: 'B103', id: '373', name: 'Date', type: 'DT', min: 8, max: 8, usage: 'required', values: null, note: null },
      { ref: 'B104', id: '558', name: 'Reservation Action Code', type: 'ID', min: 1, max: 1, usage: 'required',
        values: [{ code: 'A', description: 'Accept', note: null }, { code: 'D', description: 'Decline', note: null }], note: null }
    ]
  }
};
