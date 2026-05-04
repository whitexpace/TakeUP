<script setup lang="ts">
import type { TransactionStatus } from "#shared/schemas/transaction"

const props = defineProps<{
  status: TransactionStatus
  role?: "LENDER" | "BORROWER"
  context?: "user" | "admin"
}>()

const label = computed(() => {
  if (props.context === "admin") {
    switch (props.status) {
      case "PENDING":
        return "Pending"
      case "ACTIVE":
        return "Active"
      case "COMPLETED":
        return "Completed"
      case "CANCELLED":
        return "Cancelled"
      case "RETURNED":
        return "Returned"
      case "IN_DISPUTE":
        return "In Dispute"
      default:
        return ""
    }
  }

  switch (props.status) {
    case "PENDING":
      return props.role === "BORROWER" ? "To Receive" : "Ready for Approval"
    case "ACTIVE":
      return "In Use"
    case "COMPLETED":
      return "Completed"
    case "CANCELLED":
      return "Cancelled"
    case "RETURNED":
      return "Item Returned"
    case "IN_DISPUTE":
      return "In Dispute"
    default:
      return ""
  }
})

const badgeClass = computed(() => {
  switch (props.status) {
    case "PENDING":
      return "bg-burning-orange/[0.08] text-burning-orange border-burning-orange/20"
    case "COMPLETED":
      return "bg-success-green/[0.08] text-success-green border-success-green/20"
    case "ACTIVE":
    case "RETURNED":
      return "bg-blue-estate/[0.08] text-blue-estate border-blue-estate/20"
    case "CANCELLED":
    case "IN_DISPUTE":
      return "bg-cinnabar-red/[0.08] text-cinnabar-red border-cinnabar-red/20"
    default:
      return "bg-gray-100 text-gray-500 border-gray-200"
  }
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold font-geist uppercase tracking-[0.1em] shrink-0 border"
    :class="badgeClass"
  >
    {{ label }}
  </span>
</template>
