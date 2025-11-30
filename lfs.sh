git lfs install

# Create or overwrite .gitattributes with only the large files that are NOT ignored
> .gitattributes  # start clean (or append if you prefer)

find . -type f -size +1M ! -path '*/.git/*' | while read file; do
  # Skip if the file is ignored by git
  if ! git check-ignore -q "$file"; then
    # Convert path to pattern that works well in .gitattributes
    pattern="${file#./}"  # remove leading ./
    echo "Adding $pattern to Git LFS"
    echo "$pattern filter=lfs diff=lfs merge=lfs -text" >> .gitattributes
  fi
done

# Clean up duplicates and sort
sort -u .gitattributes -o .gitattributes