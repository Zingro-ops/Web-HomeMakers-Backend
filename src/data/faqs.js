export const FAQS = [
  {
    id: "1",
    category: "orders",
    question: "How do I track my order?",
    answer: "Go to Orders > Order Details to see live status updates.",
  },
  {
    id: "2",
    category: "orders",
    question: "Can I cancel my order?",
    answer:
      "Orders can be cancelled only while status is still 'Pending', before the cook starts preparing.",
  },
  {
    id: "3",
    category: "payments",
    question: "What payment methods are accepted?",
    answer: "Cards, UPI, and Netbanking via Razorpay.",
  },
  {
    id: "4",
    category: "payments",
    question: "My payment failed but money was deducted. What do I do?",
    // Do not promise an automatic refund here: Zingro has no payment webhook or
    // reconciliation job yet, so nothing on our side guarantees one. Any
    // reversal of an uncompleted payment is done by the bank/payment network,
    // on their timeline. Revisit this copy once A5 (webhook + reconcile) ships.
    answer:
      "Please don't pay again. Open My Orders to see the order's payment status. If it doesn't show as paid and money left your account, contact support with your payment ID (from your bank or UPI app) and we'll check it against our records. Some banks reverse incomplete payments on their own, but we can't promise a timeline for that.",
  },
  {
    id: "5",
    category: "account",
    question: "How do I update my delivery address?",
    answer: "Go to Profile > Addresses to add, edit, or set a default address.",
  },
  {
    id: "6",
    category: "account",
    question: "How do I delete my account?",
    answer:
      "Go to Profile > Settings > Delete Account. This action is permanent.",
  },
  {
    id: "7",
    category: "subscriptions",
    question: "Can I pause my subscription?",
    answer:
      "Yes, go to Subscriptions > select your plan > Pause. You can resume anytime.",
  },
];
