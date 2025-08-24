- name: Commit and push updated winners
  run: |
    git config user.name "github-actions"
    git config user.email "actions@github.com"
    git add winners.json
    if git diff --cached --quiet; then
      echo "⏸ No new winners to commit."
    else
      git commit -m "Update winners.json via GitHub Actions"
      git push https://x-access-token:${{ secrets.PAT_TOKEN }}@github.com/<username>/<repo>.git HEAD:main
      echo "✅ Winners.json updated and pushed."
    fi
