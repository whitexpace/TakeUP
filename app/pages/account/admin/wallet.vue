<script setup lang="ts">
definePageMeta({
  middleware: "account-auth",
})

await navigateTo("/admin/wallet", { replace: true })
</script>
