<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: [
    "admin-auth",
    function () {
      return navigateTo("/admin/disputes", { replace: true, redirectCode: 302 })
    },
  ],
})
</script>
