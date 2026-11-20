-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_userId_revoked_idx" ON "oauth_access_tokens"("userId", "revoked");

-- CreateIndex
CREATE INDEX "post_authors_authorId_idx" ON "post_authors"("authorId");

-- CreateIndex
CREATE INDEX "post_categories_categoryId_idx" ON "post_categories"("categoryId");

-- CreateIndex
CREATE INDEX "post_tags_tagId_idx" ON "post_tags"("tagId");

-- CreateIndex
CREATE INDEX "subscribers_status_idx" ON "subscribers"("status");
