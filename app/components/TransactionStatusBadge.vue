<script setup lang="ts">
import type { TransactionStatus } from "../../shared/schemas/transaction"

const props = defineProps<{
  status: TransactionStatus
  role: "LENDER" | "BORROWER"
}>()

const label = computed(() => {
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
    default:
      return ""
  }
})

const badgeClass = computed(() => {
  switch (props.status) {
    case "PENDING":
      return "bg-burning-orange"
    case "ACTIVE":
    case "COMPLETED":
    case "RETURNED":
      return "bg-indigo-900"
    case "CANCELLED":
      return "bg-cinnabar-red"
    default:
      return "bg-gray-400"
  }
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-md px-3 py-1 text-base font-normal font-geist text-white"
    :class="badgeClass"
  >
    {{ label }}
  </span>
</template>
