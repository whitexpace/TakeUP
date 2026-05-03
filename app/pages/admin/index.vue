<script setup lang="ts">
definePageMeta({
  middleware: ["admin-auth", () => navigateTo("/admin/transactions", { replace: true })],
})
</script>
