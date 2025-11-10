const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

const contentValidation = [
  body('type').isIn(['quote', 'prompt', 'article', 'video', 'book']),
  body('title').optional().isLength({ min: 5, max: 500 }),
  body('content').optional().isLength({ min: 10, max: 5000 }),
  body('author').optional().isLength({ max: 255 }),
  body('url').optional().isURL(),
  body('category').notEmpty(),
  body('tags').optional().isArray({ max: 10 })
];

router.post('/addContent', authenticateToken, contentValidation, async (req, res) => {
  console.log("Adding content:", req.body);
  try {
    const errors = validationResult(req.body);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { userId, type, title, content, author, url, category, tags } = req.body;
    // const userId = req.body.userId;
    console.log("User ID:", userId);
    console.log("Content Type:", type);
    console.log("Title:", title);
    console.log("Content:", content);
    console.log("Author:", author);
    console.log("URL:", url);
    console.log("Category:", category);
    console.log("Tags:", tags);
    const db = getDB();

    // Get category ID
    const [categoryResult] = await db.execute(
      'SELECT id FROM categories WHERE slug = ? AND is_deleted = 0',
      [category]
    );

    console.log("Category Result:", categoryResult);

    if (categoryResult.length === 0) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    const categoryId = categoryResult[0].id;
    console.log("categoryId:", categoryId);
    
    const dbType = type === 'prompt' ? 'aiprompt' : type;
    let contentId;

    // Insert based on type
    switch (dbType) {
      case 'quote':
        const [existingQuotes] = await db.execute(
          'SELECT COUNT(*) as count FROM quotes WHERE quote = ? AND author = ? AND category_id = ? AND user_id = ? AND is_deleted = 0',
          [content, author, categoryId, userId]
        );
        if (existingQuotes[0].count > 0) {
          return res.status(400).json({ message: 'Quote already exists' });
        }

        const [quoteResult] = await db.execute(
          'INSERT INTO quotes (quote, author, category_id, user_id) VALUES (?, ?, ?, ?)',
          [content, author, categoryId, userId]
        );
        contentId = quoteResult.insertId;
        break;

      case 'article':
        const [existingArticles] = await db.execute(
          'SELECT COUNT(*) as count FROM articles WHERE title = ? AND url = ? AND category_id = ? AND user_id = ? AND is_deleted = 0',
          [title, url, categoryId, userId]
        );
        if (existingArticles[0].count > 0) {
          return res.status(400).json({ message: 'Article already exists' });
        }

        const [articleResult] = await db.execute(
          'INSERT INTO articles (title, url, category_id, user_id) VALUES (?, ?, ?, ?)',
          [title, url, categoryId, userId]
        );
        contentId = articleResult.insertId;
        break;

      case 'book':
        const [existingBooks] = await db.execute(
          'SELECT COUNT(*) as count FROM books WHERE title = ? AND summary = ? AND author = ? AND category_id = ? AND user_id = ? AND is_deleted = 0',
          [title, content, author, categoryId, userId]
        );
        if (existingBooks[0].count > 0) {
          return res.status(400).json({ message: 'Book already exists' });
        }

        const [bookResult] = await db.execute(
          'INSERT INTO books (title, summary, author, url, category_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
          [title, content, author, url, categoryId, userId]
        );
        contentId = bookResult.insertId;
        break;

      case 'video':
        const [existingVideos] = await db.execute(
          'SELECT COUNT(*) as count FROM videos WHERE title = ? AND url = ? AND category_id = ? AND user_id = ? AND is_deleted = 0',
          [title, url, categoryId, userId]
        );
        if (existingVideos[0].count > 0) {
          return res.status(400).json({ message: 'Video already exists' });
        }

        const [videoResult] = await db.execute(
          'INSERT INTO videos (title, url, category_id, user_id) VALUES (?, ?, ?, ?)',
          [title, url, categoryId, userId]
        );
        contentId = videoResult.insertId;
        break;

      case 'aiprompt':
        const [existingPrompts] = await db.execute(
          'SELECT COUNT(*) as count FROM aiprompts WHERE prompt = ? AND category_id = ? AND user_id = ? AND is_deleted = 0',
          [content, categoryId, userId]
        );
        if (existingPrompts[0].count > 0) {
          return res.status(400).json({ message: 'AI Prompt already exists' });
        }

        const [promptResult] = await db.execute(
          'INSERT INTO aiprompts (prompt, category_id, user_id) VALUES (?, ?, ?)',
          [content, categoryId, userId]
        );
        contentId = promptResult.insertId;
        break;

      default:
        return res.status(400).json({ message: 'Invalid content type' });
    }

    // Handle tags
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (let tagName of tags) {
        if (tagName.trim()) {
          const normalizedTag = tagName.trim().toLowerCase();
          console.log("normalize:",normalizedTag);
          
          
          await db.execute('INSERT IGNORE INTO tags (name) VALUES (?)', [normalizedTag]);
          
          const [tagResult] = await db.execute('SELECT id FROM tags WHERE name = ?', [normalizedTag]);
          console.log("tagResult:",tagResult);
          const tagId = tagResult[0].id;
          console.log("tagId:",tagId);
          
          const tagTable = `${dbType}_tags`;
          console.log("tagTable:",tagTable);
          const contentColumn = `${dbType}_id`;
          console.log("contentColumn:",contentColumn);
          
          await db.execute(
            `INSERT IGNORE INTO ${tagTable} (${contentColumn}, tag_id) VALUES (?, ?)`,
            [contentId, tagId]
          );
        }
      }
    }

    // logger.info(`Content created: ${dbType} by user ${userId}`);

    res.status(201).json({ id: contentId, message: 'Content created successfully' });
  } catch (error) {
    logger.error('Create content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.put('/:contentId/updateContent', authenticateToken, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { type, title, content, author, url, category, tags } = req.body;
    const userId = req.user.id;
    const db = getDB();

    console.log(`🧩 Received contentId: ${contentId}, type: ${type}, title: ${title}, content: ${content}, author: ${author}, url: ${url}, category: ${category}, tags: ${tags}, userId: ${userId}`);

    // 🧠 Validation
    if (!contentId || isNaN(contentId)) {
      return res.status(400).json({ message: 'Invalid contentId' });
    }

    if (!type || !['article', 'quote', 'book', 'video', 'aiprompt'].includes(type)) {
      return res.status(400).json({ message: 'Invalid content type' });
    }

    // 🧠 Base query setup
    let updateQuery = '';
    let params = [];

    // 🧩 Build type-specific update query
    switch (type) {
      case 'quote':
        updateQuery = `
          UPDATE quotes 
          SET quote = ?, author = ?, category_id = ?, updated_at = NOW() 
          WHERE id = ? AND user_id = ?
        `;
        params = [content, author, category, contentId, userId];
        break;

      case 'article':
        updateQuery = `
          UPDATE articles 
          SET title = ?, url = ?, category_id = ?, updated_at = NOW() 
          WHERE id = ? AND user_id = ?
        `;
        params = [title, url, category, contentId, userId];
        break;

      case 'book':
        updateQuery = `
          UPDATE books 
          SET title = ?, summary = ?, author = ?, url = ?, category_id = ?, updated_at = NOW() 
          WHERE id = ? AND user_id = ?
        `;
        params = [title, content, author, url, category, contentId, userId];
        break;

      case 'video':
        updateQuery = `
          UPDATE videos 
          SET title = ?, url = ?, category_id = ?, updated_at = NOW() 
          WHERE id = ? AND user_id = ?
        `;
        params = [title, url, category, contentId, userId];
        break;

      case 'aiprompt':
        updateQuery = `
          UPDATE aiprompts 
          SET prompts = ?, category_id = ?, updated_at = NOW() 
          WHERE id = ? AND user_id = ?
        `;
        params = [content, category, contentId, userId];
        break;
    }

    // 🧠 Execute update query
    const [result] = await db.execute(updateQuery, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No record found or unauthorized to update this content' });
    }

    console.log(`✅ ${type} content updated successfully (ID: ${contentId})`);

    // 🏷️ Handle tags (if provided)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      console.log(`🏷️ Processing tags for ${type}, contentId: ${contentId}`);

      for (const tagName of tags) {
        // 1️⃣ Check if tag already exists
        const [existingTag] = await db.execute(`SELECT id FROM tags WHERE name = ?`, [tagName]);
        let tagId;

        if (existingTag.length > 0) {
          tagId = existingTag[0].id;
          console.log(`✅ Tag "${tagName}" already exists (ID: ${tagId})`);
        } else {
          const [insertTagResult] = await db.execute(`INSERT INTO tags (name) VALUES (?)`, [tagName]);
          tagId = insertTagResult.insertId;
          console.log(`🆕 New tag inserted: "${tagName}" (ID: ${tagId})`);
        }

        // 2️⃣ Determine tag mapping table and ID column
        let tagTable = '';
        let idColumn = '';

        switch (type) {
          case 'quote':
            tagTable = 'quote_tags';
            idColumn = 'quote_id';
            break;
          case 'article':
            tagTable = 'article_tags';
            idColumn = 'article_id';
            break;
          case 'book':
            tagTable = 'book_tags';
            idColumn = 'book_id';
            break;
          case 'video':
            tagTable = 'video_tags';
            idColumn = 'video_id';
            break;
          case 'aiprompt':
            tagTable = 'aiprompt_tags';
            idColumn = 'aiprompt_id';
            break;
        }

        // 3️⃣ Check if mapping exists in the specific tag table
        const [existingMapping] = await db.execute(
          `SELECT * FROM ${tagTable} WHERE ${idColumn} = ? AND tag_id = ?`,
          [contentId, tagId]
        );

        if (existingMapping.length > 0) {
          console.log(`🔁 Tag "${tagName}" already linked to ${type} ID ${contentId}`);
        } else {
          await db.execute(
            `INSERT INTO ${tagTable} (${idColumn}, tag_id) VALUES (?, ?)`,
            [contentId, tagId]
          );
          console.log(`🔗 Linked tag "${tagName}" (ID: ${tagId}) to ${type} ID ${contentId}`);
        }

      
      }

      console.log(`✅ All tags processed successfully for ${type} ID ${contentId}`);
    }

    // ✅ Final success response
    return res.json({ message: `${type} content updated successfully` });

  } catch (err) {
    console.error('❌ Error updating content:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});


router.delete('/:contentId/deleteContent', authenticateToken, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { contentType } = req.query;
    const userId = req.user.id;
    console.log(`🚫 Received contentId: ${contentId}, contentTpe: ${contentType}, userId: ${userId}`);
    const db = getDB();
let table;
switch (contentType) {
  case 'article':
    table = 'articles';
    break;
  case 'quote':
    table = 'quotes';
    break;
  case 'book':
    table = 'books';
    break;
  case 'video':
    table = 'videos';
    break;
  case 'aiprompt':
    table = 'aiprompts';
    break;
  default:
    return res.status(400).json({ message: 'Invalid content type' });
}

    const [rows] = await db.execute(
      `UPDATE ${table} SET is_deleted = 1 WHERE id = ? `,
      [contentId]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }

    return res.status(200).json({ message: 'Content deleted successfully' });
  } catch (error) {
    logger.error('Delete content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }

});


// Add comment

router.post('/:contentId/comments', authenticateToken, async (req, res) => {
  console.log("🟢 Adding comment request body:", req);

  try {
    const { contentId } = req.params;
    const { comment } = req.body; // ✅ direct destructuring (not text.comment)
    const userId = req.user.id;
    const postType = req.body.postType; // ✅ get postType from request body

    console.log("🆔 Content ID:", contentId);
    console.log("💬 Comment text:", comment);
    console.log("👤 User ID:", userId);
    console.log("📄 Post Type:", postType);

    const db = getDB();

    // 🧩 Validate input
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required' });
    }



    if (!postType) {
      return res.status(404).json({ message: 'Content not found' });
    }

    // 🚫 Check for duplicate comment
    const [existingComments] = await db.execute(
      'SELECT COUNT(*) as count FROM comments WHERE post_id = ? AND post_type = ? AND user_id = ? AND comment = ? AND is_deleted = 0',
      [contentId, postType, userId, comment.trim()]
    );

    if (existingComments[0].count > 0) {
      return res.status(400).json({ message: 'Duplicate comment' });
    }

    // 💾 Insert comment
    const [result] = await db.execute(
      'INSERT INTO comments (post_id, post_type, user_id, comment) VALUES (?, ?, ?, ?)',
      [contentId, postType, userId, comment.trim()]
    );

    // 👥 Fetch user info
    const [users] = await db.execute('SELECT username FROM users WHERE id = ?', [userId]);

    const newComment = {
      id: result.insertId,
      text: comment.trim(),
      user: `@${users[0].username}`,
      createdAt: Date.now(),
      createdBy: `@${users[0].username}`,
    };

    console.log("✅ Comment added:", newComment);

    res.status(201).json({ comment: newComment, message: 'Comment added successfully' });
  } catch (error) {
    console.error("❌ Add comment error:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete comment
router.delete('/deleteComment/:contentId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { contentId, commentId } = req.params;
    const userId = req.user.id;
    const db = getDB();

    console.log("🗑️ Deleting comment:", { contentId, commentId, userId });

    // Ensure all IDs are numbers to avoid SQL injection
    const postId = parseInt(contentId, 10);
    const commentID = parseInt(commentId, 10);
    const userID = parseInt(userId, 10);

    if (isNaN(postId) || isNaN(commentID) || isNaN(userID)) {
      return res.status(400).json({ message: 'Invalid ID provided' });
    }

    // Soft delete (set is_deleted = 1)
    const [result] = await db.execute(
      'UPDATE comments SET is_deleted = 1 WHERE post_id = ? AND id = ? AND user_id = ? AND is_deleted = 0',
      [postId, commentID, userID]
    );

    if (result.affectedRows > 0) {
      console.log('✅ Comment deleted successfully');
      return res.status(200).json({ message: 'Comment deleted successfully' });
    } else {
      console.warn('⚠️ Comment not found or already deleted');
      return res.status(404).json({ message: 'Comment not found or already deleted' });
    }
  } catch (error) {
    console.error('❌ Delete comment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = router;