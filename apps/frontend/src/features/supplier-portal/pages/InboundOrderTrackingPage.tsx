import PurchaseOrdersWindow from '../components/PurchaseOrdersWindow';
import type { InboundReceipt } from '../types';

type InboundOrderTrackingPageProps = {
  compact?: boolean;
  receipts?: InboundReceipt[];
};

export default function InboundOrderTrackingPage({ compact, receipts = [] }: InboundOrderTrackingPageProps) {
  return <PurchaseOrdersWindow compact={compact} receipts={receipts} />;
}
