const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../services/auth-service/src/controllers/auth.controller.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetLF = 'const user = await db.user.findFirst({\n      where: {\n        email: validatedData.email,\n        role: validatedData.role as any\n      }\n    });';
const targetCRLF = 'const user = await db.user.findFirst({\r\n      where: {\r\n        email: validatedData.email,\r\n        role: validatedData.role as any\r\n      }\r\n    });';

const addition = `
    if (!user) {
      return res.status(401).json({ 
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    if ((user as any).deletedAt) {
      return res.status(401).json({ message: 'الحساب معطل أو محذوف' });
    }

    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
      throw new Error('FATAL ERROR: JWT_SECRET or REFRESH_TOKEN_SECRET is not defined');
    }

    // Short-lived access token (15 minutes)
    const token = jwt.sign(
      { 
        userId: user.id, 
        role: user.role, 
        email: user.email, 
        institutionId: user.institutionId, 
        branchId: user.branchId,
        isPrimaryManager: Boolean(user.isPrimaryManager)
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const jti = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { userId: user.id, jti },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        branchId: user.branchId,
        isPrimaryManager: Boolean(user.isPrimaryManager),
        mustChangePassword: Boolean((user as any).mustChangePassword),
        financialAccessStatus: (user as any).financialAccessStatus || 'ACTIVE',
        academicLevel: user.academicLevel,
        country: user.country,
        educationLevel: user.educationLevel,
        gradeLevel: user.gradeLevel,
        language: user.language
      }
    });
  } catch (error: any) {
    console.error('🔥 CRITICAL LOGIN ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error', detail: error.message });
  }
};`;

if (content.includes(targetCRLF)) {
  content = content.replace(targetCRLF, targetCRLF + addition.replace(/\n/g, '\r\n'));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated CRLF content');
} else if (content.includes(targetLF)) {
  content = content.replace(targetLF, targetLF + addition);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated LF content');
} else {
  console.error('Target not found in content!');
}

