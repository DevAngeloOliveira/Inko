-- Gerado por scripts/seeds/generate-catalog-seed.mjs a partir de data/seeds/catalogo-obras.json. Não edite à mão.
-- Substitui as obras fictícias da V1000 apenas quando ainda estão intactas e acrescenta o catálogo curado.
-- Idempotente: nenhum registro cadastrado pela aplicação é alterado ou removido.

UPDATE livros SET titulo = 'One Piece', autor = 'Eiichiro Oda', categoria = 'Mangá', volume = 'Vol. 1', editora = NULL, titulo_original = 'ONE PIECE'
WHERE id = 'INK-0001' AND titulo = 'Maré de Tinta' AND autor = 'Aiko Tanabe';

UPDATE livros SET titulo = 'Naruto', autor = 'Masashi Kishimoto', categoria = 'Mangá', volume = 'Vol. 1', editora = NULL, titulo_original = 'NARUTO -ナルト-'
WHERE id = 'INK-0002' AND titulo = 'O Último Ronin' AND autor = 'Kenji Arata';

UPDATE livros SET titulo = 'Batman: Year One', autor = 'Frank Miller e David Mazzucchelli', categoria = 'HQ', volume = 'Edição encadernada', editora = NULL, titulo_original = NULL
WHERE id = 'INK-0003' AND titulo = 'Capitão Ferrugem' AND autor = 'Rafael Moura';

UPDATE livros SET titulo = 'Dragon Ball', autor = 'Akira Toriyama', categoria = 'Mangá', volume = 'Vol. 1', editora = NULL, titulo_original = 'ドラゴンボール'
WHERE id = 'INK-0004' AND titulo = 'Kitsune Express' AND autor = 'Haru Mizuki';

UPDATE livros SET titulo = 'Berserk', autor = 'Kentaro Miura', categoria = 'Mangá', volume = 'Vol. 1', editora = NULL, titulo_original = 'ベルセルク'
WHERE id = 'INK-0005' AND titulo = 'Jardim de Aço' AND autor = 'Sora Ikeda';

UPDATE livros SET titulo = 'Maus', autor = 'Art Spiegelman', categoria = 'Graphic novel', volume = 'Vol. 1', editora = NULL, titulo_original = NULL
WHERE id = 'INK-0006' AND titulo = 'Noite Sem Lua' AND autor = 'Lia Sato';

UPDATE livros SET titulo = 'Kingdom Come', autor = 'Mark Waid e Alex Ross', categoria = 'HQ', volume = 'Edição encadernada', editora = NULL, titulo_original = NULL
WHERE id = 'INK-0007' AND titulo = 'Liga dos Faróis' AND autor = 'Bruno Teles';

UPDATE livros SET titulo = 'Death Note', autor = 'Tsugumi Ohba e Takeshi Obata', categoria = 'Mangá', volume = 'Vol. 1', editora = NULL, titulo_original = 'DEATH NOTE'
WHERE id = 'INK-0008' AND titulo = 'Pétalas de Ferro' AND autor = 'Mei Kurogane';

UPDATE livros SET titulo = 'Fullmetal Alchemist', autor = 'Hiromu Arakawa', categoria = 'Mangá', volume = 'Vol. 1', editora = NULL, titulo_original = '鋼の錬金術師'
WHERE id = 'INK-0009' AND titulo = 'Kitsune Express' AND autor = 'Haru Mizuki';

UPDATE livros SET titulo = 'Saga', autor = 'Brian K. Vaughan e Fiona Staples', categoria = 'HQ', volume = 'Vol. 1', editora = NULL, titulo_original = NULL
WHERE id = 'INK-0010' AND titulo = 'Liga dos Faróis' AND autor = 'Bruno Teles';

UPDATE livros SET titulo = 'Attack on Titan', autor = 'Hajime Isayama', categoria = 'Mangá', volume = 'Vol. 1', editora = NULL, titulo_original = '進撃の巨人'
WHERE id = 'INK-0011' AND titulo = 'Jardim de Aço' AND autor = 'Sora Ikeda';

UPDATE livros SET titulo = 'Jujutsu Kaisen', autor = 'Gege Akutami', categoria = 'Mangá', volume = 'Vol. 1', editora = NULL, titulo_original = '呪術廻戦'
WHERE id = 'INK-0012' AND titulo = 'Maré de Tinta' AND autor = 'Aiko Tanabe';

INSERT INTO livros (id, titulo, autor, categoria, volume, editora, titulo_original) VALUES
    ('INK-0001', 'One Piece', 'Eiichiro Oda', 'Mangá', 'Vol. 1', NULL, 'ONE PIECE'),
    ('INK-0002', 'Naruto', 'Masashi Kishimoto', 'Mangá', 'Vol. 1', NULL, 'NARUTO -ナルト-'),
    ('INK-0003', 'Batman: Year One', 'Frank Miller e David Mazzucchelli', 'HQ', 'Edição encadernada', NULL, NULL),
    ('INK-0004', 'Dragon Ball', 'Akira Toriyama', 'Mangá', 'Vol. 1', NULL, 'ドラゴンボール'),
    ('INK-0005', 'Berserk', 'Kentaro Miura', 'Mangá', 'Vol. 1', NULL, 'ベルセルク'),
    ('INK-0006', 'Maus', 'Art Spiegelman', 'Graphic novel', 'Vol. 1', NULL, NULL),
    ('INK-0007', 'Kingdom Come', 'Mark Waid e Alex Ross', 'HQ', 'Edição encadernada', NULL, NULL),
    ('INK-0008', 'Death Note', 'Tsugumi Ohba e Takeshi Obata', 'Mangá', 'Vol. 1', NULL, 'DEATH NOTE'),
    ('INK-0009', 'Fullmetal Alchemist', 'Hiromu Arakawa', 'Mangá', 'Vol. 1', NULL, '鋼の錬金術師'),
    ('INK-0010', 'Saga', 'Brian K. Vaughan e Fiona Staples', 'HQ', 'Vol. 1', NULL, NULL),
    ('INK-0011', 'Attack on Titan', 'Hajime Isayama', 'Mangá', 'Vol. 1', NULL, '進撃の巨人'),
    ('INK-0012', 'Jujutsu Kaisen', 'Gege Akutami', 'Mangá', 'Vol. 1', NULL, '呪術廻戦'),
    ('INK-0013', 'Bleach', 'Tite Kubo', 'Mangá', 'Vol. 1', NULL, 'BLEACH'),
    ('INK-0014', 'Hunter × Hunter', 'Yoshihiro Togashi', 'Mangá', 'Vol. 1', NULL, 'HUNTER×HUNTER'),
    ('INK-0015', 'Vagabond', 'Takehiko Inoue', 'Mangá', 'Vol. 1', NULL, 'バガボンド'),
    ('INK-0016', 'Vinland Saga', 'Makoto Yukimura', 'Mangá', 'Vol. 1', NULL, 'ヴィンランド・サガ'),
    ('INK-0017', 'Monster', 'Naoki Urasawa', 'Mangá', 'Vol. 1', NULL, 'MONSTER'),
    ('INK-0018', 'Chainsaw Man', 'Tatsuki Fujimoto', 'Mangá', 'Vol. 1', NULL, 'チェンソーマン'),
    ('INK-0019', 'Demon Slayer: Kimetsu no Yaiba', 'Koyoharu Gotouge', 'Mangá', 'Vol. 1', NULL, '鬼滅の刃'),
    ('INK-0020', 'Spy × Family', 'Tatsuya Endo', 'Mangá', 'Vol. 1', NULL, 'SPY×FAMILY'),
    ('INK-0021', 'Frieren: Beyond Journey''s End', 'Kanehito Yamada e Tsukasa Abe', 'Mangá', 'Vol. 1', NULL, '葬送のフリーレン'),
    ('INK-0022', 'JoJo''s Bizarre Adventure', 'Hirohiko Araki', 'Mangá', 'Vol. 1', NULL, 'ジョジョの奇妙な冒険'),
    ('INK-0023', 'Dandadan', 'Yukinobu Tatsu', 'Mangá', 'Vol. 1', NULL, 'ダンダダン'),
    ('INK-0024', 'Tokyo Ghoul', 'Sui Ishida', 'Mangá', 'Vol. 1', NULL, '東京喰種トーキョーグール'),
    ('INK-0025', 'My Hero Academia', 'Kohei Horikoshi', 'Mangá', 'Vol. 1', NULL, '僕のヒーローアカデミア'),
    ('INK-0026', 'Slam Dunk', 'Takehiko Inoue', 'Mangá', 'Vol. 1', NULL, 'SLAM DUNK'),
    ('INK-0027', 'Haikyu!!', 'Haruichi Furudate', 'Mangá', 'Vol. 1', NULL, 'ハイキュー!!'),
    ('INK-0028', 'Sakamoto Days', 'Yuto Suzuki', 'Mangá', 'Vol. 1', NULL, 'SAKAMOTO DAYS'),
    ('INK-0029', 'Batman: The Long Halloween', 'Jeph Loeb e Tim Sale', 'HQ', 'Edição encadernada', NULL, NULL),
    ('INK-0030', 'All-Star Superman', 'Grant Morrison e Frank Quitely', 'HQ', 'Edição encadernada', NULL, NULL),
    ('INK-0031', 'The Sandman', 'Neil Gaiman, Sam Kieth e Mike Dringenberg', 'HQ', 'Vol. 1 · Preludes & Nocturnes', NULL, NULL),
    ('INK-0032', 'Wonder Woman: The Hiketeia', 'Greg Rucka e J. G. Jones', 'HQ', 'Edição única', NULL, NULL),
    ('INK-0033', 'Spider-Man: Blue', 'Jeph Loeb e Tim Sale', 'HQ', 'Edição encadernada', NULL, NULL),
    ('INK-0034', 'Marvels', 'Kurt Busiek e Alex Ross', 'HQ', 'Edição encadernada', NULL, NULL),
    ('INK-0035', 'Civil War', 'Mark Millar e Steve McNiven', 'HQ', 'Edição encadernada', NULL, NULL),
    ('INK-0036', 'The Infinity Gauntlet', 'Jim Starlin, George Pérez e Ron Lim', 'HQ', 'Edição encadernada', NULL, NULL),
    ('INK-0037', 'X-Men: Days of Future Past', 'Chris Claremont e John Byrne', 'HQ', 'Edição encadernada', NULL, NULL),
    ('INK-0038', 'Invincible', 'Robert Kirkman e Cory Walker', 'HQ', 'Vol. 1', NULL, NULL),
    ('INK-0039', 'The Walking Dead', 'Robert Kirkman e Tony Moore', 'HQ', 'Vol. 1', NULL, NULL),
    ('INK-0040', 'Spawn', 'Todd McFarlane', 'HQ', 'Vol. 1', NULL, NULL),
    ('INK-0041', 'Hellboy: Seed of Destruction', 'Mike Mignola e John Byrne', 'HQ', 'Vol. 1', NULL, NULL),
    ('INK-0042', 'The Umbrella Academy', 'Gerard Way e Gabriel Bá', 'HQ', 'Vol. 1 · Apocalypse Suite', NULL, NULL),
    ('INK-0043', 'Watchmen', 'Alan Moore e Dave Gibbons', 'Graphic novel', 'Edição completa', NULL, NULL),
    ('INK-0044', 'Persepolis', 'Marjane Satrapi', 'Graphic novel', 'Edição completa', NULL, NULL),
    ('INK-0045', 'Scott Pilgrim', 'Bryan Lee O''Malley', 'Graphic novel', 'Vol. 1', NULL, NULL),
    ('INK-0046', 'V for Vendetta', 'Alan Moore e David Lloyd', 'Graphic novel', 'Edição completa', NULL, NULL),
    ('INK-0047', 'Blankets', 'Craig Thompson', 'Graphic novel', 'Edição única', NULL, NULL),
    ('INK-0048', 'Daytripper', 'Fábio Moon e Gabriel Bá', 'Graphic novel', 'Edição completa', NULL, NULL),
    ('INK-0049', 'Heartstopper', 'Alice Oseman', 'Graphic novel', 'Vol. 1', NULL, NULL),
    ('INK-0050', 'Bone', 'Jeff Smith', 'Graphic novel', 'Vol. 1', NULL, NULL)
ON CONFLICT (id) DO NOTHING;
