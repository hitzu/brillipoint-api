export enum ReservationAnalyticsAction {
  VIEWED = 'reservation_viewed',
  SECTION_VIEWED = 'reservation_section_viewed',
  SECTION_LEFT = 'reservation_section_left',
  BLOCK_VIEWED = 'reservation_block_viewed',
  RECEIPT_OPENED = 'reservation_receipt_opened',
  PREP_ANSWERED = 'reservation_prep_answered',
  TATTOO_UPLOADED = 'reservation_tattoo_uploaded',
  TATTOO_SELECTED = 'reservation_tattoo_selected',
}

// `source` for rows owned by a contract. Kept out of AnalyticsSource so the
// per-source guest summaries keep their shape.
export const RESERVATION_ANALYTICS_SOURCE = 'reservation';
