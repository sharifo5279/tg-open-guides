/**
 * X12 segment dictionary.
 *
 * One accurate definition per segment, reused across every transaction set and
 * every hub. Hubs differ by overriding usage, restricting code lists and adding
 * notes, which is exactly how real implementation guides differ from each other
 * and from the standard. Defining a segment once means a correction lands
 * everywhere rather than in one guide.
 *
 * Element entries carry the X12 data element number in `id`, which is what an
 * EDI analyst cross-references against the standard.
 */

const e = (ref, id, name, type, min, max, usage = 'optional', values = null, note = null) => ({
  ref, id, name, type, min, max, usage, values, note
});

const c = (code, description, note = null) => ({ code, description, note });

export const SEGMENTS = {
  /* ---------------------------------------------------------- envelope */
  ST: {
    name: 'Transaction Set Header',
    elements: [
      e('ST01', '143', 'Transaction Set Identifier Code', 'ID', 3, 3, 'required'),
      e('ST02', '329', 'Transaction Set Control Number', 'AN', 4, 9, 'required', null,
        'Unique within the functional group, and must equal SE02.')
    ]
  },
  SE: {
    name: 'Transaction Set Trailer',
    elements: [
      e('SE01', '96', 'Number of Included Segments', 'N0', 1, 10, 'required', null, 'Inclusive of ST and SE.'),
      e('SE02', '329', 'Transaction Set Control Number', 'AN', 4, 9, 'required', null, 'Must equal ST02.')
    ]
  },
  CTT: {
    name: 'Transaction Totals',
    elements: [
      e('CTT01', '354', 'Number of Line Items', 'N0', 1, 6, 'required'),
      e('CTT02', '347', 'Hash Total', 'R', 1, 10, 'optional')
    ]
  },

  /* ------------------------------------------------------------ common */
  REF: {
    name: 'Reference Identification',
    elements: [
      e('REF01', '128', 'Reference Identification Qualifier', 'ID', 2, 3, 'required'),
      e('REF02', '127', 'Reference Identification', 'AN', 1, 30, 'required'),
      e('REF03', '352', 'Description', 'AN', 1, 80, 'optional')
    ]
  },
  DTM: {
    name: 'Date/Time Reference',
    elements: [
      e('DTM01', '374', 'Date/Time Qualifier', 'ID', 3, 3, 'required'),
      e('DTM02', '373', 'Date', 'DT', 8, 8, 'required', null, 'CCYYMMDD.'),
      e('DTM03', '337', 'Time', 'TM', 4, 8, 'conditional')
    ]
  },
  N1: {
    name: 'Name',
    elements: [
      e('N101', '98', 'Entity Identifier Code', 'ID', 2, 3, 'required'),
      e('N102', '93', 'Name', 'AN', 1, 60, 'optional'),
      e('N103', '66', 'Identification Code Qualifier', 'ID', 1, 2, 'required'),
      e('N104', '67', 'Identification Code', 'AN', 2, 80, 'required')
    ]
  },
  N3: {
    name: 'Address Information',
    elements: [
      e('N301', '166', 'Address Information', 'AN', 1, 55, 'required'),
      e('N302', '166', 'Address Information', 'AN', 1, 55, 'optional')
    ]
  },
  N4: {
    name: 'Geographic Location',
    elements: [
      e('N401', '19', 'City Name', 'AN', 2, 30, 'required'),
      e('N402', '156', 'State or Province Code', 'ID', 2, 2, 'required'),
      e('N403', '116', 'Postal Code', 'ID', 3, 15, 'required'),
      e('N404', '26', 'Country Code', 'ID', 2, 3, 'conditional', null, 'Required when the address is outside the United States.')
    ]
  },
  PER: {
    name: 'Administrative Communications Contact',
    elements: [
      e('PER01', '366', 'Contact Function Code', 'ID', 2, 2, 'required'),
      e('PER02', '93', 'Name', 'AN', 1, 60, 'optional'),
      e('PER03', '365', 'Communication Number Qualifier', 'ID', 2, 2, 'conditional'),
      e('PER04', '364', 'Communication Number', 'AN', 1, 80, 'conditional')
    ]
  },
  CUR: {
    name: 'Currency',
    elements: [
      e('CUR01', '98', 'Entity Identifier Code', 'ID', 2, 3, 'required', [c('BY', 'Buying party'), c('SE', 'Selling party')]),
      e('CUR02', '100', 'Currency Code', 'ID', 3, 3, 'required')
    ]
  },
  TD1: {
    name: 'Carrier Details (Quantity and Weight)',
    elements: [
      e('TD101', '103', 'Packaging Code', 'AN', 3, 5, 'required'),
      e('TD102', '80', 'Lading Quantity', 'N0', 1, 7, 'required'),
      e('TD106', '187', 'Weight Qualifier', 'ID', 1, 2, 'required', [c('G', 'Gross weight')]),
      e('TD107', '81', 'Weight', 'R', 1, 10, 'required'),
      e('TD108', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'required', [c('LB', 'Pounds'), c('KG', 'Kilograms')])
    ]
  },
  TD5: {
    name: 'Carrier Details (Routing Sequence)',
    elements: [
      e('TD501', '133', 'Routing Sequence Code', 'ID', 1, 2, 'required', [c('B', 'Origin/delivery carrier')]),
      e('TD502', '66', 'Identification Code Qualifier', 'ID', 1, 2, 'required', [c('2', 'Standard Carrier Alpha Code (SCAC)')]),
      e('TD503', '67', 'Identification Code', 'AN', 2, 80, 'required', null, 'Four character SCAC.'),
      e('TD504', '91', 'Transportation Method/Type Code', 'ID', 1, 2, 'required')
    ]
  },
  TD3: {
    name: 'Carrier Details (Equipment)',
    elements: [
      e('TD301', '40', 'Equipment Description Code', 'ID', 2, 2, 'required', [c('TL', 'Trailer'), c('CN', 'Container')]),
      e('TD302', '206', 'Equipment Initial', 'AN', 1, 4, 'optional'),
      e('TD303', '207', 'Equipment Number', 'AN', 1, 10, 'required')
    ]
  },
  FOB: {
    name: 'F.O.B. Related Instructions',
    elements: [
      e('FOB01', '146', 'Shipment Method of Payment', 'ID', 2, 2, 'required',
        [c('CC', 'Collect'), c('PP', 'Prepaid'), c('PC', 'Prepaid and charged to customer')]),
      e('FOB02', '309', 'Location Qualifier', 'ID', 1, 2, 'optional'),
      e('FOB03', '352', 'Description', 'AN', 1, 80, 'optional')
    ]
  },

  /* --------------------------------------------------------------- 850 */
  BEG: {
    name: 'Beginning Segment for Purchase Order',
    elements: [
      e('BEG01', '353', 'Transaction Set Purpose Code', 'ID', 2, 2, 'required',
        [c('00', 'Original'), c('07', 'Duplicate')]),
      e('BEG02', '92', 'Purchase Order Type Code', 'ID', 2, 2, 'required'),
      e('BEG03', '324', 'Purchase Order Number', 'AN', 1, 22, 'required'),
      e('BEG05', '373', 'Date', 'DT', 8, 8, 'required', null, 'Order date, CCYYMMDD.')
    ]
  },
  PO1: {
    name: 'Baseline Item Data',
    elements: [
      e('PO101', '350', 'Assigned Identification', 'AN', 1, 20, 'required', null, 'Line number, unique within the order.'),
      e('PO102', '330', 'Quantity Ordered', 'R', 1, 15, 'required'),
      e('PO103', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'required'),
      e('PO104', '212', 'Unit Price', 'R', 1, 17, 'required'),
      e('PO106', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'required'),
      e('PO107', '234', 'Product/Service ID', 'AN', 1, 48, 'required'),
      e('PO108', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'conditional'),
      e('PO109', '234', 'Product/Service ID', 'AN', 1, 48, 'conditional')
    ]
  },
  PID: {
    name: 'Product/Item Description',
    elements: [
      e('PID01', '349', 'Item Description Type', 'ID', 1, 1, 'required', [c('F', 'Free-form')]),
      e('PID05', '352', 'Description', 'AN', 1, 80, 'required')
    ]
  },
  PO4: {
    name: 'Item Physical Details',
    elements: [
      e('PO401', '356', 'Pack', 'N0', 1, 6, 'optional'),
      e('PO402', '357', 'Size', 'R', 1, 8, 'optional'),
      e('PO403', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'optional'),
      e('PO404', '103', 'Packaging Code', 'AN', 3, 5, 'optional')
    ]
  },
  SAC: {
    name: 'Service, Promotion, Allowance or Charge Information',
    elements: [
      e('SAC01', '248', 'Allowance or Charge Indicator', 'ID', 1, 1, 'required',
        [c('A', 'Allowance'), c('C', 'Charge'), c('N', 'No allowance or charge')]),
      e('SAC02', '1300', 'Service, Promotion, Allowance or Charge Code', 'ID', 4, 4, 'conditional'),
      e('SAC05', '610', 'Amount', 'N2', 1, 15, 'conditional')
    ]
  },
  ITD: {
    name: 'Terms of Sale/Deferred Terms of Sale',
    elements: [
      e('ITD01', '336', 'Terms Type Code', 'ID', 2, 2, 'required'),
      e('ITD02', '333', 'Terms Basis Date Code', 'ID', 1, 2, 'optional'),
      e('ITD03', '338', 'Terms Discount Percent', 'R', 1, 6, 'optional'),
      e('ITD07', '386', 'Terms Net Days', 'N0', 1, 3, 'conditional')
    ]
  },

  /* --------------------------------------------------------------- 855 */
  BAK: {
    name: 'Beginning Segment for Purchase Order Acknowledgment',
    elements: [
      e('BAK01', '353', 'Transaction Set Purpose Code', 'ID', 2, 2, 'required', [c('00', 'Original')]),
      e('BAK02', '587', 'Acknowledgment Type', 'ID', 2, 2, 'required'),
      e('BAK03', '324', 'Purchase Order Number', 'AN', 1, 22, 'required', null, 'The PO being acknowledged.'),
      e('BAK04', '373', 'Date', 'DT', 8, 8, 'required', null, 'Original PO date.'),
      e('BAK08', '373', 'Date', 'DT', 8, 8, 'optional', null, 'Acknowledgment date.')
    ]
  },
  ACK: {
    name: 'Line Item Acknowledgment',
    elements: [
      e('ACK01', '668', 'Line Item Status Code', 'ID', 2, 2, 'required'),
      e('ACK02', '380', 'Quantity', 'R', 1, 15, 'conditional'),
      e('ACK03', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'conditional'),
      e('ACK04', '374', 'Date/Time Qualifier', 'ID', 3, 3, 'optional', [c('068', 'Current schedule ship')]),
      e('ACK05', '373', 'Date', 'DT', 8, 8, 'optional')
    ]
  },

  /* --------------------------------------------------------------- 860 */
  BCH: {
    name: 'Beginning Segment for Purchase Order Change',
    elements: [
      e('BCH01', '353', 'Transaction Set Purpose Code', 'ID', 2, 2, 'required',
        [c('01', 'Cancellation'), c('04', 'Change')]),
      e('BCH02', '92', 'Purchase Order Type Code', 'ID', 2, 2, 'required'),
      e('BCH03', '324', 'Purchase Order Number', 'AN', 1, 22, 'required'),
      e('BCH06', '373', 'Date', 'DT', 8, 8, 'required', null, 'Original order date.'),
      e('BCH10', '373', 'Date', 'DT', 8, 8, 'required', null, 'Change date.')
    ]
  },
  POC: {
    name: 'Line Item Change',
    elements: [
      e('POC01', '350', 'Assigned Identification', 'AN', 1, 20, 'required', null, 'The original line number.'),
      e('POC02', '670', 'Change or Response Type Code', 'ID', 2, 2, 'required'),
      e('POC03', '330', 'Quantity Ordered', 'R', 1, 15, 'conditional'),
      e('POC05', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'conditional'),
      e('POC06', '212', 'Unit Price', 'R', 1, 17, 'conditional'),
      e('POC08', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'conditional'),
      e('POC09', '234', 'Product/Service ID', 'AN', 1, 48, 'conditional')
    ]
  },

  /* --------------------------------------------------------------- 856 */
  BSN: {
    name: 'Beginning Segment for Ship Notice',
    elements: [
      e('BSN01', '353', 'Transaction Set Purpose Code', 'ID', 2, 2, 'required',
        [c('00', 'Original'), c('01', 'Cancellation'), c('07', 'Duplicate')]),
      e('BSN02', '396', 'Shipment Identification', 'AN', 2, 30, 'required'),
      e('BSN03', '373', 'Date', 'DT', 8, 8, 'required'),
      e('BSN04', '337', 'Time', 'TM', 4, 8, 'required'),
      e('BSN05', '1005', 'Hierarchical Structure Code', 'ID', 4, 4, 'required')
    ]
  },
  HL: {
    name: 'Hierarchical Level',
    elements: [
      e('HL01', '628', 'Hierarchical ID Number', 'AN', 1, 12, 'required'),
      e('HL02', '734', 'Hierarchical Parent ID Number', 'AN', 1, 12, 'conditional'),
      e('HL03', '735', 'Hierarchical Level Code', 'ID', 1, 2, 'required'),
      e('HL04', '736', 'Hierarchical Child Code', 'ID', 1, 1, 'conditional')
    ]
  },
  MAN: {
    name: 'Marks and Numbers',
    elements: [
      e('MAN01', '88', 'Marks and Numbers Qualifier', 'ID', 1, 2, 'required'),
      e('MAN02', '87', 'Marks and Numbers', 'AN', 1, 48, 'required')
    ]
  },
  LIN: {
    name: 'Item Identification',
    elements: [
      e('LIN01', '350', 'Assigned Identification', 'AN', 1, 20, 'optional'),
      e('LIN02', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'required'),
      e('LIN03', '234', 'Product/Service ID', 'AN', 1, 48, 'required'),
      e('LIN04', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'conditional'),
      e('LIN05', '234', 'Product/Service ID', 'AN', 1, 48, 'conditional')
    ]
  },
  SN1: {
    name: 'Item Detail (Shipment)',
    elements: [
      e('SN101', '350', 'Assigned Identification', 'AN', 1, 20, 'optional'),
      e('SN102', '382', 'Number of Units Shipped', 'R', 1, 10, 'required'),
      e('SN103', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'required'),
      e('SN105', '330', 'Quantity Ordered', 'R', 1, 15, 'optional')
    ]
  },
  PRF: {
    name: 'Purchase Order Reference',
    elements: [
      e('PRF01', '324', 'Purchase Order Number', 'AN', 1, 22, 'required'),
      e('PRF02', '328', 'Release Number', 'AN', 1, 30, 'optional'),
      e('PRF04', '373', 'Date', 'DT', 8, 8, 'optional')
    ]
  },

  /* --------------------------------------------------------------- 810 */
  BIG: {
    name: 'Beginning Segment for Invoice',
    elements: [
      e('BIG01', '373', 'Date', 'DT', 8, 8, 'required', null, 'Invoice date.'),
      e('BIG02', '76', 'Invoice Number', 'AN', 1, 22, 'required'),
      e('BIG03', '373', 'Date', 'DT', 8, 8, 'conditional', null, 'Purchase order date.'),
      e('BIG04', '324', 'Purchase Order Number', 'AN', 1, 22, 'required'),
      e('BIG07', '640', 'Transaction Type Code', 'ID', 2, 2, 'optional',
        [c('DI', 'Debit invoice'), c('CR', 'Credit memo')])
    ]
  },
  IT1: {
    name: 'Baseline Item Data (Invoice)',
    elements: [
      e('IT101', '350', 'Assigned Identification', 'AN', 1, 20, 'required', null, 'Must match the PO line number.'),
      e('IT102', '358', 'Quantity Invoiced', 'R', 1, 10, 'required'),
      e('IT103', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'required'),
      e('IT104', '212', 'Unit Price', 'R', 1, 17, 'required'),
      e('IT106', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'required'),
      e('IT107', '234', 'Product/Service ID', 'AN', 1, 48, 'required')
    ]
  },
  TDS: {
    name: 'Total Monetary Value Summary',
    elements: [
      e('TDS01', '361', 'Total Invoice Amount', 'N2', 1, 15, 'required',
        null, 'Implied two decimal places, no decimal point, no currency symbol.')
    ]
  },
  TXI: {
    name: 'Tax Information',
    elements: [
      e('TXI01', '963', 'Tax Type Code', 'ID', 2, 2, 'required'),
      e('TXI02', '782', 'Monetary Amount', 'R', 1, 18, 'conditional'),
      e('TXI03', '954', 'Percent', 'R', 1, 10, 'optional')
    ]
  },

  /* --------------------------------------------------------------- 820 */
  BPR: {
    name: 'Beginning Segment for Payment Order/Remittance Advice',
    elements: [
      e('BPR01', '305', 'Transaction Handling Code', 'ID', 1, 2, 'required',
        [c('I', 'Remittance information only'), c('C', 'Payment accompanies remittance')]),
      e('BPR02', '782', 'Monetary Amount', 'R', 1, 18, 'required', null, 'Total payment amount.'),
      e('BPR03', '478', 'Credit/Debit Flag Code', 'ID', 1, 1, 'required', [c('C', 'Credit'), c('D', 'Debit')]),
      e('BPR04', '591', 'Payment Method Code', 'ID', 3, 3, 'required'),
      e('BPR16', '373', 'Date', 'DT', 8, 8, 'required', null, 'Payment effective date.')
    ]
  },
  TRN: {
    name: 'Trace',
    elements: [
      e('TRN01', '481', 'Trace Type Code', 'ID', 1, 2, 'required', [c('1', 'Current transaction trace numbers')]),
      e('TRN02', '127', 'Reference Identification', 'AN', 1, 30, 'required', null, 'Payment or cheque number.')
    ]
  },
  RMR: {
    name: 'Remittance Advice Accounts Receivable Open Item Reference',
    elements: [
      e('RMR01', '128', 'Reference Identification Qualifier', 'ID', 2, 3, 'required',
        [c('IV', 'Invoice number'), c('PO', 'Purchase order number')]),
      e('RMR02', '127', 'Reference Identification', 'AN', 1, 30, 'required'),
      e('RMR03', '482', 'Payment Action Code', 'ID', 2, 2, 'optional'),
      e('RMR04', '782', 'Monetary Amount', 'R', 1, 18, 'required', null, 'Amount paid against this item.'),
      e('RMR05', '782', 'Monetary Amount', 'R', 1, 18, 'optional', null, 'Original invoice amount.')
    ]
  },
  ADX: {
    name: 'Adjustment',
    elements: [
      e('ADX01', '782', 'Monetary Amount', 'R', 1, 18, 'required'),
      e('ADX02', '426', 'Adjustment Reason Code', 'ID', 2, 2, 'required')
    ]
  },

  /* --------------------------------------------------------------- 824 */
  BGN: {
    name: 'Beginning Segment',
    elements: [
      e('BGN01', '353', 'Transaction Set Purpose Code', 'ID', 2, 2, 'required', [c('11', 'Response')]),
      e('BGN02', '127', 'Reference Identification', 'AN', 1, 30, 'required'),
      e('BGN03', '373', 'Date', 'DT', 8, 8, 'required'),
      e('BGN04', '337', 'Time', 'TM', 4, 8, 'optional')
    ]
  },
  OTI: {
    name: 'Original Transaction Identification',
    elements: [
      e('OTI01', '110', 'Application Acknowledgment Code', 'ID', 1, 2, 'required'),
      e('OTI02', '128', 'Reference Identification Qualifier', 'ID', 2, 3, 'required'),
      e('OTI03', '127', 'Reference Identification', 'AN', 1, 30, 'required'),
      e('OTI10', '143', 'Transaction Set Identifier Code', 'ID', 3, 3, 'optional')
    ]
  },
  TED: {
    name: 'Technical Error Description',
    elements: [
      e('TED01', '647', 'Application Error Condition Code', 'ID', 1, 3, 'required'),
      e('TED02', '3', 'Free Form Message', 'AN', 1, 60, 'optional')
    ]
  },

  /* --------------------------------------------------------- 830 / 862 */
  BFR: {
    name: 'Beginning Segment for Planning Schedule',
    elements: [
      e('BFR01', '353', 'Transaction Set Purpose Code', 'ID', 2, 2, 'required',
        [c('00', 'Original'), c('05', 'Replace')]),
      e('BFR02', '127', 'Reference Identification', 'AN', 1, 30, 'conditional', null, 'Release number.'),
      e('BFR04', '675', 'Schedule Type Qualifier', 'ID', 2, 2, 'required',
        [c('DL', 'Delivery based'), c('SH', 'Shipment based')]),
      e('BFR05', '676', 'Schedule Quantity Qualifier', 'ID', 1, 1, 'required',
        [c('A', 'Actual discrete quantities'), c('C', 'Cumulative quantities')]),
      e('BFR06', '373', 'Date', 'DT', 8, 8, 'required', null, 'Horizon start date.'),
      e('BFR07', '373', 'Date', 'DT', 8, 8, 'required', null, 'Horizon end date.'),
      e('BFR08', '373', 'Date', 'DT', 8, 8, 'required', null, 'Schedule generation date.')
    ]
  },
  BSS: {
    name: 'Beginning Segment for Shipping Schedule',
    elements: [
      e('BSS01', '353', 'Transaction Set Purpose Code', 'ID', 2, 2, 'required', [c('00', 'Original'), c('05', 'Replace')]),
      e('BSS02', '127', 'Reference Identification', 'AN', 1, 30, 'required'),
      e('BSS03', '373', 'Date', 'DT', 8, 8, 'required'),
      e('BSS04', '675', 'Schedule Type Qualifier', 'ID', 2, 2, 'required', [c('DL', 'Delivery based'), c('SH', 'Shipment based')]),
      e('BSS05', '373', 'Date', 'DT', 8, 8, 'required', null, 'Horizon start.'),
      e('BSS06', '373', 'Date', 'DT', 8, 8, 'required', null, 'Horizon end.')
    ]
  },
  LIN_SCHED: {
    id: 'LIN',
    name: 'Item Identification (Schedule)',
    elements: [
      e('LIN01', '350', 'Assigned Identification', 'AN', 1, 20, 'optional'),
      e('LIN02', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'required', [c('BP', "Buyer's part number")]),
      e('LIN03', '234', 'Product/Service ID', 'AN', 1, 48, 'required'),
      e('LIN04', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'conditional', [c('EC', 'Engineering change level')]),
      e('LIN05', '234', 'Product/Service ID', 'AN', 1, 48, 'conditional')
    ]
  },
  UIT: {
    name: 'Unit Detail',
    elements: [
      e('UIT01', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'required'),
      e('UIT02', '212', 'Unit Price', 'R', 1, 17, 'optional')
    ]
  },
  FST: {
    name: 'Forecast Schedule',
    elements: [
      e('FST01', '380', 'Quantity', 'R', 1, 15, 'required'),
      e('FST02', '680', 'Forecast Qualifier', 'ID', 1, 1, 'required',
        [c('C', 'Firm'), c('D', 'Planning')]),
      e('FST03', '681', 'Forecast Timing Qualifier', 'ID', 1, 1, 'required',
        [c('D', 'Discrete'), c('W', 'Weekly bucket'), c('M', 'Monthly bucket')]),
      e('FST04', '373', 'Date', 'DT', 8, 8, 'required', null, 'Requirement date.'),
      e('FST05', '373', 'Date', 'DT', 8, 8, 'conditional', null, 'End of bucket, when FST03 is W or M.')
    ]
  },
  SHP: {
    name: 'Shipped/Received Information',
    elements: [
      e('SHP01', '673', 'Quantity Qualifier', 'ID', 2, 2, 'required',
        [c('01', 'Discrete quantity'), c('02', 'Cumulative quantity')]),
      e('SHP02', '380', 'Quantity', 'R', 1, 15, 'required'),
      e('SHP03', '374', 'Date/Time Qualifier', 'ID', 3, 3, 'optional', [c('011', 'Shipped')]),
      e('SHP04', '373', 'Date', 'DT', 8, 8, 'optional')
    ]
  },

  /* --------------------------------------------------------------- 846 */
  BIA: {
    name: 'Beginning Segment for Inventory Inquiry/Advice',
    elements: [
      e('BIA01', '353', 'Transaction Set Purpose Code', 'ID', 2, 2, 'required', [c('00', 'Original')]),
      e('BIA02', '755', 'Report Type Code', 'ID', 2, 2, 'required'),
      e('BIA03', '127', 'Reference Identification', 'AN', 1, 30, 'required'),
      e('BIA04', '373', 'Date', 'DT', 8, 8, 'required'),
      e('BIA05', '337', 'Time', 'TM', 4, 8, 'optional')
    ]
  },
  QTY: {
    name: 'Quantity',
    elements: [
      e('QTY01', '673', 'Quantity Qualifier', 'ID', 2, 2, 'required'),
      e('QTY02', '380', 'Quantity', 'R', 1, 15, 'required'),
      e('QTY03', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'optional')
    ]
  },

  /* --------------------------------------------------------------- 852 */
  XQ: {
    name: 'Reporting Date/Action',
    elements: [
      e('XQ01', '560', 'Status Code', 'ID', 2, 2, 'required', [c('F', 'Final'), c('P', 'Preliminary')]),
      e('XQ02', '373', 'Date', 'DT', 8, 8, 'required', null, 'Start of the reporting period.'),
      e('XQ03', '373', 'Date', 'DT', 8, 8, 'conditional', null, 'End of the reporting period.')
    ]
  },
  XPO: {
    id: 'ZA',
    name: 'Product Activity Reporting',
    elements: [
      e('ZA01', '859', 'Activity Code', 'ID', 2, 2, 'required'),
      e('ZA02', '380', 'Quantity', 'R', 1, 15, 'required'),
      e('ZA03', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'required')
    ]
  },

  /* --------------------------------------------------------------- 997 */
  AK1: {
    name: 'Functional Group Response Header',
    elements: [
      e('AK101', '479', 'Functional Identifier Code', 'ID', 2, 2, 'required'),
      e('AK102', '28', 'Group Control Number', 'N0', 1, 9, 'required')
    ]
  },
  AK2: {
    name: 'Transaction Set Response Header',
    elements: [
      e('AK201', '143', 'Transaction Set Identifier Code', 'ID', 3, 3, 'required'),
      e('AK202', '329', 'Transaction Set Control Number', 'AN', 4, 9, 'required')
    ]
  },
  AK3: {
    name: 'Data Segment Note',
    elements: [
      e('AK301', '721', 'Segment ID Code', 'ID', 2, 3, 'required'),
      e('AK302', '719', 'Segment Position in Transaction Set', 'N0', 1, 6, 'required'),
      e('AK304', '720', 'Segment Syntax Error Code', 'ID', 1, 3, 'optional')
    ]
  },
  AK5: {
    name: 'Transaction Set Response Trailer',
    elements: [
      e('AK501', '717', 'Transaction Set Acknowledgment Code', 'ID', 1, 1, 'required',
        [c('A', 'Accepted'), c('E', 'Accepted with errors'), c('R', 'Rejected')]),
      e('AK502', '718', 'Transaction Set Syntax Error Code', 'ID', 1, 3, 'optional')
    ]
  },
  AK9: {
    name: 'Functional Group Response Trailer',
    elements: [
      e('AK901', '715', 'Functional Group Acknowledge Code', 'ID', 1, 1, 'required',
        [c('A', 'Accepted'), c('E', 'Accepted with errors'), c('R', 'Rejected')]),
      e('AK902', '97', 'Number of Transaction Sets Included', 'N0', 1, 6, 'required'),
      e('AK903', '123', 'Number of Received Transaction Sets', 'N0', 1, 6, 'required'),
      e('AK904', '2', 'Number of Accepted Transaction Sets', 'N0', 1, 6, 'required')
    ]
  },

  /* ---------------------------------------------------- 204 / 214 / 990 */
  B2: {
    name: 'Beginning Segment for Shipment Information Transaction',
    elements: [
      e('B201', '375', 'Tariff Service Code', 'ID', 2, 2, 'optional'),
      e('B202', '145', 'Standard Carrier Alpha Code', 'ID', 2, 4, 'required'),
      e('B204', '145', 'Shipment Identification Number', 'AN', 1, 30, 'required'),
      e('B206', '146', 'Shipment Method of Payment', 'ID', 2, 2, 'required',
        [c('PP', 'Prepaid'), c('CC', 'Collect'), c('TP', 'Third party')])
    ]
  },
  B2A: {
    name: 'Set Purpose',
    elements: [
      e('B2A01', '353', 'Transaction Set Purpose Code', 'ID', 2, 2, 'required',
        [c('00', 'Original'), c('01', 'Cancellation'), c('04', 'Change')]),
      e('B2A02', '346', 'Application Type', 'ID', 2, 2, 'optional')
    ]
  },
  B10: {
    name: 'Beginning Segment for Transportation Carrier Shipment Status',
    elements: [
      e('B1001', '127', 'Reference Identification', 'AN', 1, 30, 'required', null, "Carrier's PRO number."),
      e('B1002', '145', 'Shipment Identification Number', 'AN', 1, 30, 'required'),
      e('B1003', '140', 'Standard Carrier Alpha Code', 'ID', 2, 4, 'required')
    ]
  },
  AT7: {
    name: 'Shipment Status Details',
    elements: [
      e('AT701', '1650', 'Shipment Status Code', 'ID', 2, 2, 'required'),
      e('AT702', '1651', 'Shipment Status or Appointment Reason Code', 'ID', 2, 2, 'conditional'),
      e('AT705', '374', 'Date/Time Qualifier', 'ID', 3, 3, 'required'),
      e('AT706', '373', 'Date', 'DT', 8, 8, 'required'),
      e('AT707', '337', 'Time', 'TM', 4, 8, 'required'),
      e('AT708', '623', 'Time Code', 'ID', 2, 2, 'required', null, 'Local time zone of the event.')
    ]
  },
  MS1: {
    name: 'Equipment, Shipment or Real Property Location',
    elements: [
      e('MS101', '19', 'City Name', 'AN', 2, 30, 'required'),
      e('MS102', '156', 'State or Province Code', 'ID', 2, 2, 'required'),
      e('MS103', '26', 'Country Code', 'ID', 2, 3, 'optional')
    ]
  },
  L11: {
    name: 'Business Instructions and Reference Number',
    elements: [
      e('L1101', '127', 'Reference Identification', 'AN', 1, 30, 'required'),
      e('L1102', '128', 'Reference Identification Qualifier', 'ID', 2, 3, 'required')
    ]
  },
  S5: {
    name: 'Stop Off Details',
    elements: [
      e('S501', '165', 'Stop Sequence Number', 'N0', 1, 3, 'required'),
      e('S502', '163', 'Stop Reason Code', 'ID', 2, 2, 'required',
        [c('LD', 'Load'), c('UL', 'Unload')]),
      e('S503', '382', 'Number of Units Shipped', 'R', 1, 10, 'optional'),
      e('S506', '81', 'Weight', 'R', 1, 10, 'optional'),
      e('S507', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'optional')
    ]
  },
  G62: {
    name: 'Date/Time',
    elements: [
      e('G6201', '432', 'Date Qualifier', 'ID', 2, 2, 'required'),
      e('G6202', '373', 'Date', 'DT', 8, 8, 'required'),
      e('G6203', '176', 'Time Qualifier', 'ID', 1, 2, 'conditional'),
      e('G6204', '337', 'Time', 'TM', 4, 8, 'conditional')
    ]
  },
  OID: {
    name: 'Order Identification Detail',
    elements: [
      e('OID01', '127', 'Reference Identification', 'AN', 1, 30, 'optional'),
      e('OID02', '324', 'Purchase Order Number', 'AN', 1, 22, 'required'),
      e('OID05', '380', 'Quantity', 'R', 1, 15, 'optional'),
      e('OID07', '81', 'Weight', 'R', 1, 10, 'optional')
    ]
  },
  A1: {
    name: 'Response to a Load Tender',
    elements: [
      e('A101', '558', 'Reservation Action Code', 'ID', 1, 1, 'required',
        [c('A', 'Accept'), c('D', 'Decline')]),
      e('A102', '145', 'Shipment Identification Number', 'AN', 1, 30, 'required'),
      e('A103', '373', 'Date', 'DT', 8, 8, 'optional')
    ]
  },

  /* ---------------------------------------------------------- 940 / 945 */
  W05: {
    name: 'Shipping Order Identification',
    elements: [
      e('W0501', '353', 'Order Status Code', 'ID', 1, 1, 'required', [c('N', 'New'), c('F', 'Final')]),
      e('W0502', '285', 'Depositor Order Number', 'AN', 1, 22, 'required'),
      e('W0503', '128', 'Purchase Order Number', 'AN', 1, 22, 'optional')
    ]
  },
  W06: {
    name: 'Warehouse Shipment Identification',
    elements: [
      e('W0601', '662', 'Reporting Code', 'ID', 1, 1, 'required', [c('F', 'Final shipment'), c('N', 'New shipment')]),
      e('W0602', '285', 'Depositor Order Number', 'AN', 1, 22, 'required'),
      e('W0603', '373', 'Date', 'DT', 8, 8, 'required'),
      e('W0604', '127', 'Shipment Identification Number', 'AN', 1, 30, 'optional')
    ]
  },
  W01: {
    name: 'Line Item Detail (Warehouse)',
    elements: [
      e('W0101', '330', 'Quantity Ordered', 'R', 1, 9, 'required'),
      e('W0102', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'required'),
      e('W0103', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'required'),
      e('W0104', '234', 'Product/Service ID', 'AN', 1, 48, 'required')
    ]
  },
  W12: {
    name: 'Line Item Detail (Shipped)',
    elements: [
      e('W1201', '668', 'Shipment Order Status Code', 'ID', 2, 2, 'required'),
      e('W1202', '330', 'Quantity Ordered', 'R', 1, 9, 'required'),
      e('W1203', '358', 'Quantity Shipped', 'R', 1, 9, 'required'),
      e('W1205', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'required'),
      e('W1206', '235', 'Product/Service ID Qualifier', 'ID', 2, 2, 'required'),
      e('W1207', '234', 'Product/Service ID', 'AN', 1, 48, 'required')
    ]
  },
  W03: {
    name: 'Total Shipment Information',
    elements: [
      e('W0301', '382', 'Number of Units Shipped', 'R', 1, 10, 'required'),
      e('W0302', '81', 'Weight', 'R', 1, 10, 'optional'),
      e('W0303', '355', 'Unit or Basis for Measurement Code', 'ID', 2, 2, 'optional')
    ]
  },
  LX: {
    name: 'Assigned Number',
    elements: [
      e('LX01', '554', 'Assigned Number', 'N0', 1, 6, 'required')
    ]
  }
};

/** Resolve a segment key to its real X12 segment id (some keys disambiguate reuse). */
export function segmentId(key) {
  return SEGMENTS[key]?.id || key;
}
