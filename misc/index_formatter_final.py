#!/usr/bin/env python3
"""
Index Alphabetizer and Page Range Formatter - Final Version

This script alphabetizes index entries and formats consecutive page numbers
into ranges according to specific formatting rules.
"""

import re
import sys
from typing import List, Tuple, Dict, Optional


def parse_page_numbers(page_string: str) -> List[int]:
    """Extract and sort page numbers from a comma-separated string."""
    if not page_string.strip():
        return []
    
    # Remove any extra whitespace and split by commas
    pages = []
    for page in page_string.split(','):
        page = page.strip()
        if page.isdigit():
            pages.append(int(page))
    
    return sorted(set(pages))  # Remove duplicates and sort


def format_page_range(start: int, end: int) -> str:
    """
    Format a page range according to the specified rules:
    
    1–99: Use all digits (3–10, 71–72, 96–117)
    100 or multiples of 100: Use all digits (100–104, 1100–1113)
    101-109, 201-209, etc.: Use changed part only (101–8, 1103–4)
    110-199, 210-299, etc.: Use two or more digits as needed (321–28, 498–532, 1087–89, 11564–615, 12991–13001)
    """
    if start == end:
        return str(start)
    
    start_str = str(start)
    end_str = str(end)
    
    # Rule 1: Numbers 1-99, use all digits
    if end < 100:
        return f"{start}–{end}"
    
    # Rule 2: Multiples of 100, use all digits
    if start % 100 == 0:
        return f"{start}–{end}"
    
    # Rule 3: 101-109, 201-209, etc. (X01-X09), use changed part only
    # This applies when start is X01-X09 and end is in the same hundred
    if (start % 100 >= 1 and start % 100 <= 9 and 
        start // 100 == end // 100):
        return f"{start}–{end % 10}"
    
    # Rule 4: All other cases, use minimal digits needed for clarity
    
    # Same hundred and same number of digits
    if (start // 100 == end // 100 and 
        len(start_str) == len(end_str)):
        # For ranges like 321-328, use 321–28
        return f"{start}–{end_str[-2:]}"
    
    # Different hundreds or crossing major boundaries
    # Try to find common prefix and use minimal suffix
    common_prefix_len = 0
    for i in range(min(len(start_str), len(end_str))):
        if start_str[i] == end_str[i]:
            common_prefix_len += 1
        else:
            break
    
    # Use common prefix logic for longer numbers
    if (common_prefix_len > 0 and 
        len(start_str) == len(end_str) and
        len(start_str) >= 3):
        end_suffix = end_str[common_prefix_len:]
        # Don't make it too short - at least 2 digits for clarity
        if len(end_suffix) < 2 and len(end_str) >= 3:
            end_suffix = end_str[-2:]
        return f"{start}–{end_suffix}"
    
    # Default: use all digits for safety
    return f"{start}–{end}"


def group_consecutive_pages(pages: List[int]) -> List[str]:
    """Group consecutive page numbers into ranges."""
    if not pages:
        return []
    
    if len(pages) == 1:
        return [str(pages[0])]
    
    result = []
    start = pages[0]
    end = pages[0]
    
    for i in range(1, len(pages)):
        if pages[i] == end + 1:
            # Continue the consecutive sequence
            end = pages[i]
        else:
            # End of a consecutive sequence
            if start == end:
                result.append(str(start))
            else:
                result.append(format_page_range(start, end))
            start = end = pages[i]
    
    # Handle the last range
    if start == end:
        result.append(str(start))
    else:
        result.append(format_page_range(start, end))
    
    return result


def format_pages(page_string: str) -> str:
    """Convert a comma-separated page string to formatted ranges."""
    pages = parse_page_numbers(page_string)
    if not pages:
        return ""
    
    ranges = group_consecutive_pages(pages)
    return ", ".join(ranges)


def split_term_and_pages(line: str) -> Tuple[str, str]:
    """
    Split a line into term and page numbers.
    This handles cases where the term itself might contain commas.
    """
    line = line.strip()
    if not line:
        return "", ""
    
    # Split by commas and check from the end to find where page numbers start
    parts = [part.strip() for part in line.split(',')]
    
    # Find the longest suffix that consists only of page numbers
    page_parts = []
    term_parts = []
    
    # Start from the end and collect page numbers
    for i in range(len(parts) - 1, -1, -1):
        part = parts[i]
        # Check if this part is a page number (digits only)
        if part.isdigit():
            page_parts.insert(0, part)
        else:
            # Once we hit a non-page-number, everything from here to the start is the term
            term_parts = parts[:i+1]
            break
    
    # If we didn't find any clear page numbers, treat the whole thing as a term
    if not page_parts:
        return line, ""
    
    term = ", ".join(term_parts) if term_parts else ""
    pages = ", ".join(page_parts)
    
    return term, pages


class IndexEntry:
    """Represents a main index entry with its subentries."""
    
    def __init__(self, main_term: str, pages: str = ""):
        self.main_term = main_term.strip()
        self.pages = pages.strip()
        self.subentries: List[Tuple[str, str]] = []  # (subterm, pages)
    
    def add_subentry(self, subterm: str, pages: str):
        """Add a subentry to this main entry."""
        self.subentries.append((subterm.strip(), pages.strip()))
    
    def format_entry(self) -> str:
        """Format the complete entry with main term and subentries."""
        lines = []
        
        # Format main entry
        if self.pages:
            formatted_pages = format_pages(self.pages)
            if formatted_pages:
                lines.append(f"{self.main_term}, {formatted_pages}")
            else:
                lines.append(f"{self.main_term}")
        else:
            lines.append(f"{self.main_term}")
        
        # Format subentries
        for subterm, pages in self.subentries:
            if pages:
                formatted_pages = format_pages(pages)
                if formatted_pages:
                    lines.append(f"  - {subterm}, {formatted_pages}")
                else:
                    lines.append(f"  - {subterm}")
            else:
                lines.append(f"  - {subterm}")
        
        return "\n".join(lines)


def parse_index_file(filename: str) -> List[IndexEntry]:
    """Parse the index file and return a list of IndexEntry objects."""
    entries = []
    current_entry = None
    
    with open(filename, 'r', encoding='utf-8') as file:
        for line in file:
            line = line.rstrip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Check if this is a subentry (starts with "  - ")
            if line.startswith("  - "):
                if current_entry is not None:
                    # Parse subentry
                    subentry_content = line[4:]  # Remove "  - "
                    subterm, pages = split_term_and_pages(subentry_content)
                    current_entry.add_subentry(subterm, pages)
            else:
                # This is a main entry
                term, pages = split_term_and_pages(line)
                current_entry = IndexEntry(term, pages)
                entries.append(current_entry)
    
    return entries


def alphabetize_and_format_index(input_filename: str, output_filename: str):
    """Main function to process the index file."""
    print(f"Reading index from {input_filename}...")
    
    # Parse the index
    entries = parse_index_file(input_filename)
    print(f"Found {len(entries)} main entries")
    
    # Sort entries alphabetically by main term (case-insensitive)
    entries.sort(key=lambda x: x.main_term.lower())
    
    # Write the formatted index
    print(f"Writing alphabetized and formatted index to {output_filename}...")
    with open(output_filename, 'w', encoding='utf-8') as file:
        for i, entry in enumerate(entries):
            file.write(entry.format_entry())
            # Add blank line between entries, except after the last one
            if i < len(entries) - 1:
                file.write("\n\n")
    
    print("Index processing complete!")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python index_formatter_final.py <input_file> <output_file>")
        print("Example: python index_formatter_final.py 7-11-index.txt formatted_index.txt")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    try:
        alphabetize_and_format_index(input_file, output_file)
    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error processing index: {e}")
        sys.exit(1) 