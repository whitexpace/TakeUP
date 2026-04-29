<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin-auth",
})

await navigateTo("/admin/transactions", { replace: true })
</script>
